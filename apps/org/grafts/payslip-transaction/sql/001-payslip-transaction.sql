CREATE SCHEMA payslip_transaction;

-- Which entry each pay run posted: its approval, which accrues the pay,
-- and its payment from the bank. A run carried over from before the books
-- moved here posted both in one entry. Both sides are referenced by id,
-- with no foreign key into either feat.
CREATE TABLE payslip_transaction.posting (
  entry text PRIMARY KEY,
  month text NOT NULL,
  event text NOT NULL CHECK (event IN ('accrual', 'payment', 'carried')),
  UNIQUE (month, event)
);

-- The lines a run's event posts, for a French SCOP's chart: its approval
-- charges gross pay (641) and the employer's contributions (645), owed to
-- the members as net pay (421) and to the social funds as both parties'
-- contributions (431); its payment settles both from the bank (512).
CREATE FUNCTION payslip_transaction.lines(ref text, event text)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT x.account, x.side, x.cents
  FROM (
    SELECT sum(cella.cents(p.gross)) AS gross, sum(cella.cents(p.employee)) AS employee,
           sum(cella.cents(p.employer)) AS employer, sum(cella.cents(p.net)) AS net
    FROM payslip.payslip p WHERE p.month = ref
  ) t
  CROSS JOIN LATERAL (VALUES
    ('accrual', '641', 'debit', t.gross),
    ('accrual', '645', 'debit', t.employer),
    ('accrual', '421', 'credit', t.net),
    ('accrual', '431', 'credit', t.employee + t.employer),
    ('payment', '421', 'debit', t.net),
    ('payment', '431', 'debit', t.employee + t.employer),
    ('payment', '512', 'credit', t.net + t.employee + t.employer)
  ) x (event, account, side, cents)
  WHERE x.event = lines.event AND x.cents > 0;
END;

-- Why a run's event is not in the books as it should be, or NULL: its
-- posting exists, its accrual is dated the run's last day and its payment
-- the day it was paid, and its lines are exactly the event's.
CREATE FUNCTION payslip_transaction.unposted(ref text, event text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.month IS NULL THEN 'no run for ' || coalesce(ref, 'the month')
    WHEN p.entry IS NULL THEN ref || '''s run posted no ' || unposted.event
    WHEN e.date IS DISTINCT FROM CASE unposted.event WHEN 'accrual' THEN payslip.after(ref) - 1 ELSE r.paid END
      THEN p.entry || ' is not dated on ' || ref || '''s ' || unposted.event
    WHEN EXISTS (
      (SELECT l.account, l.side, l.cents FROM payslip_transaction.lines(ref, unposted.event) l)
      EXCEPT ALL
      (SELECT t.account, t.side, cella.cents(t.amount) FROM transaction.line t WHERE t.entry = p.entry)
    ) OR EXISTS (
      (SELECT t.account, t.side, cella.cents(t.amount) FROM transaction.line t WHERE t.entry = p.entry)
      EXCEPT ALL
      (SELECT l.account, l.side, l.cents FROM payslip_transaction.lines(ref, unposted.event) l)
    ) THEN p.entry || ' does not post ' || ref || '''s ' || unposted.event
  END
  FROM (SELECT 1) one
  LEFT JOIN payslip.run r ON r.month = ref
  LEFT JOIN payslip_transaction.posting p ON p.month = ref AND p.event = unposted.event
  LEFT JOIN transaction.entry e ON e.id = p.entry;
END;

-- payslip:run:approve — the approval accrued the run's pay in the books.
CREATE FUNCTION payslip_transaction.accrued(payload jsonb) RETURNS text
LANGUAGE sql STABLE
RETURN payslip_transaction.unposted(payload ->> 'month', 'accrual');

-- payslip:run:pay — the payment settled it from the bank.
CREATE FUNCTION payslip_transaction.paid(payload jsonb) RETURNS text
LANGUAGE sql STABLE
RETURN payslip_transaction.unposted(payload ->> 'month', 'payment');

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('payslip:run:approve', 'payslip_transaction.accrued(jsonb)', 'payslip-transaction'),
  ('payslip:run:pay', 'payslip_transaction.paid(jsonb)', 'payslip-transaction');

GRANT USAGE ON SCHEMA payslip_transaction TO cella_app, cella_guards;
GRANT SELECT ON payslip_transaction.posting TO cella_app, cella_guards;
GRANT INSERT ON payslip_transaction.posting TO cella_app;
