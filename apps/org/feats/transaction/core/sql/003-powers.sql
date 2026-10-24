-- Posting needs pay-supplier, within the mandate's limit for the entry's
-- amount, the sum of its debits, which the payload names.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('transaction:transaction:post', 'pay-supplier', 'amount', 'transaction');

-- transaction:transaction:post — the amount the payload names is the
-- entry's, so the limit caps what was posted.
CREATE FUNCTION transaction.amounts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no entry ' || coalesce(p.entry, 'is named')
    WHEN p.amount IS DISTINCT FROM (
      SELECT sum(cella.cents(l.amount)) FROM transaction.line l WHERE l.entry = e.id AND l.side = 'debit'
    ) THEN e.id || ' debits other than the ' || coalesce(p.amount::text, 'no') || ' cents its payload names'
  END
  FROM (SELECT payload ->> 'entry' AS entry, (payload ->> 'amount')::numeric AS amount) p
  LEFT JOIN transaction.entry e ON e.id = p.entry;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('transaction:transaction:post', 'transaction.amounts(jsonb)', 'transaction');
