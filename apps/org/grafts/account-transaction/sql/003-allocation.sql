-- A surplus allocation posts its split: the year's result (120) debited by
-- the surplus, and each share credited to where it goes, for a French
-- SCOP's chart: the work share to what the workers are owed (424), the
-- legal reserve (1061), the development fund, an indivisible reserve
-- (1068), and the interest on capital to what the members are owed (457).
CREATE TABLE account_transaction.allocation (
  allocation text PRIMARY KEY,
  entry text NOT NULL UNIQUE
);

CREATE FUNCTION account_transaction.allocation_lines(ref text)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT '120', 'debit', cella.cents(a.surplus) FROM account.allocation a WHERE a.id = ref
  UNION ALL
  SELECT CASE s.kind WHEN 'work' THEN '424' WHEN 'legal' THEN '1061' WHEN 'development' THEN '1068' ELSE '457' END,
         'credit', cella.cents(s.amount)
  FROM account.share s WHERE s.allocation = ref;
END;

-- A member's capital, all the accounts of class 101, on a day: what the
-- journal credited them up to it, less what it debited.
CREATE FUNCTION account_transaction.capital(day date) RETURNS bigint
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END), 0)
  FROM transaction.line l
  JOIN transaction.entry e ON e.id = l.entry
  WHERE l.account LIKE '101%' AND e.date <= capital.day;
END;

-- account:surplus:allocate — the allocation is in the books: one entry,
-- dated the day it was allocated, whose lines are exactly its split.
CREATE FUNCTION account_transaction.allocated(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.entry IS NULL THEN coalesce(x.allocation, 'the allocation') || ' posted no entry'
    WHEN e.date IS DISTINCT FROM a.allocated THEN p.entry || ' is not dated on the allocation'
    WHEN EXISTS (
      (SELECT l.account, l.side, l.cents FROM account_transaction.allocation_lines(x.allocation) l)
      EXCEPT ALL
      (SELECT t.account, t.side, cella.cents(t.amount) FROM transaction.line t WHERE t.entry = p.entry)
    ) OR EXISTS (
      (SELECT t.account, t.side, cella.cents(t.amount) FROM transaction.line t WHERE t.entry = p.entry)
      EXCEPT ALL
      (SELECT l.account, l.side, l.cents FROM account_transaction.allocation_lines(x.allocation) l)
    ) THEN p.entry || ' does not post the split of ' || x.allocation
  END
  FROM (SELECT payload ->> 'allocation' AS allocation) x
  LEFT JOIN account.allocation a ON a.id = x.allocation
  LEFT JOIN account_transaction.allocation p ON p.allocation = x.allocation
  LEFT JOIN transaction.entry e ON e.id = p.entry;
END;

-- account:surplus:allocate — 15 % of the surplus goes to the legal reserve
-- until the reserve reaches the highest amount the capital ever reached
-- (loi n° 78-763 du 19 juillet 1978, art. 33, 1°). The reserve is read
-- before this allocation's own entry, and the capital's highest from every
-- day the journal moved it.
CREATE FUNCTION account_transaction.reserves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN account.share_of(a.id, 'legal') * 100 < cella.cents(a.surplus) * 15
      AND (
        SELECT coalesce(sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END), 0)
        FROM transaction.line l
        WHERE l.account = '1061' AND l.entry IS DISTINCT FROM p.entry
      ) < coalesce((
        SELECT max(account_transaction.capital(e.date))
        FROM transaction.entry e
        WHERE EXISTS (SELECT FROM transaction.line l WHERE l.entry = e.id AND l.account LIKE '101%')
      ), 0)
      THEN a.id || ' puts less than 15 % in the legal reserve, which is under the highest capital (loi 78-763, art. 33, 1°)'
  END
  FROM (SELECT payload ->> 'allocation' AS allocation) x
  JOIN account.allocation a ON a.id = x.allocation
  LEFT JOIN account_transaction.allocation p ON p.allocation = a.id;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('account:surplus:allocate', 'account_transaction.allocated(jsonb)', 'account-transaction'),
  ('account:surplus:allocate', 'account_transaction.reserves(jsonb)', 'account-transaction');

GRANT SELECT ON account_transaction.allocation TO cella_app, cella_rules;
GRANT INSERT ON account_transaction.allocation TO cella_app;
