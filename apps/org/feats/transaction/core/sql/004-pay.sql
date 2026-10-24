-- Paying a supplier needs pay-supplier, within the mandate's limit for the
-- amount paid, which the payload names.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('transaction:transaction:pay', 'pay-supplier', 'amount', 'transaction');

-- transaction:transaction:pay — the entry is exactly a payment: 401
-- (fournisseurs) debited and 512 (the bank) credited by the amount the
-- payload names, so the limit caps what left the bank.
CREATE FUNCTION transaction.pays(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no entry ' || coalesce(p.entry, 'is named')
    WHEN p.amount IS NULL THEN e.id || ' names no amount'
    WHEN (
      SELECT count(*) FILTER (WHERE NOT (
        (l.account = '401' AND l.side = 'debit') OR (l.account = '512' AND l.side = 'credit')
      )) <> 0
        OR count(*) <> 2
        OR count(DISTINCT l.account) <> 2
        OR bool_or(cella.cents(l.amount) <> p.amount)
      FROM transaction.line l WHERE l.entry = e.id
    ) THEN e.id || ' is not a payment of ' || p.amount || ' cents: 401 debited and 512 credited by it, nothing else'
  END
  FROM (SELECT payload ->> 'entry' AS entry, (payload ->> 'amount')::bigint AS amount) p
  LEFT JOIN transaction.entry e ON e.id = p.entry;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('transaction:transaction:pay', 'transaction.pays(jsonb)', 'transaction');
