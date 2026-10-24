CREATE SCHEMA expense_transaction;

-- Which entry each expense event posted: its approval, which charges it,
-- and its reimbursement, which pays it. Both sides are referenced by id,
-- with no foreign key into either feat.
CREATE TABLE expense_transaction.posting (
  entry text PRIMARY KEY,
  expense text NOT NULL,
  event text NOT NULL CHECK (event IN ('charge', 'payment')),
  UNIQUE (expense, event)
);

-- The lines an expense's event posts, for a French SCOP's chart: its
-- approval charges its category by the amount before VAT and deductible
-- VAT (44566) by the VAT, owed to the member (421) in all; its
-- reimbursement settles what is owed them (421) from the bank (512).
CREATE FUNCTION expense_transaction.lines(ref text, event text)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT x.account, x.side, x.cents
  FROM expense.expense e
  CROSS JOIN LATERAL (VALUES
    ('charge', e.category, 'debit', cella.cents(e.net)),
    ('charge', '44566', 'debit', cella.cents(e.vat)),
    ('charge', '421', 'credit', expense.total(e)),
    ('payment', '421', 'debit', expense.total(e)),
    ('payment', '512', 'credit', expense.total(e))
  ) x (event, account, side, cents)
  WHERE e.id = ref AND x.event = lines.event AND x.cents IS NOT NULL;
END;

-- Why an expense's event is not in the books as it should be, or NULL:
-- its posting exists, is dated the day of the event, and its lines are
-- exactly the event's.
CREATE FUNCTION expense_transaction.unposted(ref text, event text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no expense ' || coalesce(ref, 'is named')
    WHEN p.entry IS NULL THEN ref || ' posted no ' || unposted.event
    WHEN t.date IS DISTINCT FROM CASE unposted.event WHEN 'charge' THEN e.decided ELSE e.reimbursed END
      THEN p.entry || ' is not dated on ' || ref || '''s ' || unposted.event
    WHEN EXISTS (
      (SELECT l.account, l.side, l.cents FROM expense_transaction.lines(ref, unposted.event) l)
      EXCEPT ALL
      (SELECT x.account, x.side, cella.cents(x.amount) FROM transaction.line x WHERE x.entry = p.entry)
    ) OR EXISTS (
      (SELECT x.account, x.side, cella.cents(x.amount) FROM transaction.line x WHERE x.entry = p.entry)
      EXCEPT ALL
      (SELECT l.account, l.side, l.cents FROM expense_transaction.lines(ref, unposted.event) l)
    ) THEN p.entry || ' does not post ' || ref || '''s ' || unposted.event
  END
  FROM (SELECT 1) one
  LEFT JOIN expense.expense e ON e.id = ref
  LEFT JOIN expense_transaction.posting p ON p.expense = ref AND p.event = unposted.event
  LEFT JOIN transaction.entry t ON t.id = p.entry;
END;

-- expense:expense:approve — the approval charged the expense to the books.
CREATE FUNCTION expense_transaction.charged(payload jsonb) RETURNS text
LANGUAGE sql STABLE
RETURN expense_transaction.unposted(payload ->> 'expense', 'charge');

-- expense:expense:reimburse — the reimbursement paid it from the bank.
CREATE FUNCTION expense_transaction.paid(payload jsonb) RETURNS text
LANGUAGE sql STABLE
RETURN expense_transaction.unposted(payload ->> 'expense', 'payment');

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('expense:expense:approve', 'expense_transaction.charged(jsonb)', 'expense-transaction'),
  ('expense:expense:reimburse', 'expense_transaction.paid(jsonb)', 'expense-transaction');

GRANT USAGE ON SCHEMA expense_transaction TO cella_app, cella_rules;
GRANT SELECT ON expense_transaction.posting TO cella_app, cella_rules;
GRANT INSERT ON expense_transaction.posting TO cella_app;
