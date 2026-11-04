CREATE SCHEMA bill_transaction;

-- Which entry each bill event posted: its approval, which charges it, and
-- its payment. Both sides are referenced by id, with no foreign key into
-- either feat.
CREATE TABLE bill_transaction.posting (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  entry text PRIMARY KEY,
  bill text NOT NULL,
  event text NOT NULL CHECK (event IN ('charge', 'payment')),
  UNIQUE (bill, event)
);

-- The lines a bill's event posts, for a French SCOP's chart: its approval
-- charges its category by the net and deductible VAT (44566) by the VAT,
-- owed to the supplier (401) in all; its payment settles what is owed them
-- (401) from the bank (512).
CREATE FUNCTION bill_transaction.lines(ref text, event text)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT x.account, x.side, x.cents
  FROM bill.bill b
  CROSS JOIN LATERAL (VALUES
    ('charge', b.category, 'debit', cella.cents(b.net)),
    ('charge', '44566', 'debit', cella.cents(b.vat)),
    ('charge', '401', 'credit', cella.cents(b.total)),
    ('payment', '401', 'debit', cella.cents(b.total)),
    ('payment', '512', 'credit', cella.cents(b.total))
  ) x (event, account, side, cents)
  WHERE b.id = ref AND x.event = lines.event AND x.cents IS NOT NULL;
END;

-- Why a bill's event is not in the books as it should be, or NULL: its
-- posting exists, is dated the day of the event, and its lines are exactly
-- the event's.
CREATE FUNCTION bill_transaction.unposted(ref text, event text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN b.id IS NULL THEN 'no bill ' || coalesce(ref, 'is named')
    WHEN p.entry IS NULL THEN ref || ' posted no ' || unposted.event
    WHEN t.date IS DISTINCT FROM CASE unposted.event WHEN 'charge' THEN b.approved ELSE b.paid END
      THEN p.entry || ' is not dated on ' || ref || '''s ' || unposted.event
    WHEN EXISTS (
      (SELECT l.account, l.side, l.cents FROM bill_transaction.lines(ref, unposted.event) l)
      EXCEPT ALL
      (SELECT x.account, x.side, cella.cents(x.amount) FROM transaction.line x WHERE x.entry = p.entry)
    ) OR EXISTS (
      (SELECT x.account, x.side, cella.cents(x.amount) FROM transaction.line x WHERE x.entry = p.entry)
      EXCEPT ALL
      (SELECT l.account, l.side, l.cents FROM bill_transaction.lines(ref, unposted.event) l)
    ) THEN p.entry || ' does not post ' || ref || '''s ' || unposted.event
  END
  FROM (SELECT 1) one
  LEFT JOIN bill.bill b ON b.id = ref
  LEFT JOIN bill_transaction.posting p ON p.bill = ref AND p.event = unposted.event
  LEFT JOIN transaction.entry t ON t.id = p.entry;
END;

-- bill:bill:approve — the approval charged the bill to the books.
CREATE FUNCTION bill_transaction.charged(payload jsonb) RETURNS text
LANGUAGE sql STABLE
RETURN bill_transaction.unposted(payload ->> 'bill', 'charge');

-- bill:bill:pay — the payment paid it from the bank.
CREATE FUNCTION bill_transaction.paid(payload jsonb) RETURNS text
LANGUAGE sql STABLE
RETURN bill_transaction.unposted(payload ->> 'bill', 'payment');

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('bill:bill:approve', 'bill_transaction.charged(jsonb)', 'bill-transaction'),
  ('bill:bill:pay', 'bill_transaction.paid(jsonb)', 'bill-transaction');

GRANT USAGE ON SCHEMA bill_transaction TO cella_app, cella_guards;
GRANT SELECT ON bill_transaction.posting TO cella_app, cella_guards;
GRANT INSERT ON bill_transaction.posting TO cella_app;
