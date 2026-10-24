-- Running the payroll needs run-payroll, with no limit: wages are owed
-- whatever their size, and the entry may hold nothing but wages.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('transaction:transaction:payroll', 'run-payroll', NULL, 'transaction');

-- transaction:transaction:payroll — the entry is exactly a payroll: wages
-- (641) and social charges (645) debited, the bank (512) credited once by
-- their sum, so money leaves the bank under run-payroll only as pay.
CREATE FUNCTION transaction.payroll(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no entry ' || coalesce(p.entry, 'is named')
    WHEN (
      SELECT count(*) FILTER (WHERE NOT (
        (l.account IN ('641', '645') AND l.side = 'debit') OR (l.account = '512' AND l.side = 'credit')
      )) <> 0
        OR count(*) FILTER (WHERE l.account = '512') <> 1
      FROM transaction.line l WHERE l.entry = e.id
    ) THEN e.id || ' is not a payroll: wages (641) and charges (645) debited, the bank (512) credited by their sum, nothing else'
  END
  FROM (SELECT payload ->> 'entry' AS entry) p
  LEFT JOIN transaction.entry e ON e.id = p.entry;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('transaction:transaction:payroll', 'transaction.payroll(jsonb)', 'transaction');
