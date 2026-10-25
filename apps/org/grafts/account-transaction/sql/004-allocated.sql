-- account:surplus:allocate — the allocation is in the books: one entry,
-- dated the day it was allocated, which posts every line of its split.
-- A write posts one entry, so what a graft above posts in the same write,
-- such as the work share employed in shares, is lines of that entry: they
-- balance among themselves and touch neither the year's result (120) nor
-- a cash account, and the graft that adds them checks they are exactly
-- its own.
CREATE OR REPLACE FUNCTION account_transaction.allocated(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.entry IS NULL THEN coalesce(x.allocation, 'the allocation') || ' posted no entry'
    WHEN e.date IS DISTINCT FROM a.allocated THEN p.entry || ' is not dated on the allocation'
    WHEN EXISTS (
      (SELECT l.account, l.side, l.cents FROM account_transaction.allocation_lines(x.allocation) l)
      EXCEPT ALL
      (SELECT t.account, t.side, cella.cents(t.amount) FROM transaction.line t WHERE t.entry = p.entry)
    ) THEN p.entry || ' does not post the split of ' || x.allocation
    WHEN EXISTS (
      SELECT FROM (
        (SELECT t.account, t.side, cella.cents(t.amount) AS cents FROM transaction.line t WHERE t.entry = p.entry)
        EXCEPT ALL
        (SELECT l.account, l.side, l.cents FROM account_transaction.allocation_lines(x.allocation) l)
      ) r
      WHERE r.account = '120' OR EXISTS (SELECT FROM account.account c WHERE c.code = r.account AND c.cash)
    ) OR (
      SELECT coalesce(sum(CASE r.side WHEN 'debit' THEN r.cents ELSE -r.cents END), 0) FROM (
        (SELECT t.account, t.side, cella.cents(t.amount) AS cents FROM transaction.line t WHERE t.entry = p.entry)
        EXCEPT ALL
        (SELECT l.account, l.side, l.cents FROM account_transaction.allocation_lines(x.allocation) l)
      ) r
    ) <> 0 THEN p.entry || ' posts more than the split of ' || x.allocation || ', and not in balance away from the result and the cash'
  END
  FROM (SELECT payload ->> 'allocation' AS allocation) x
  LEFT JOIN account.allocation a ON a.id = x.allocation
  LEFT JOIN account_transaction.allocation p ON p.allocation = x.allocation
  LEFT JOIN transaction.entry e ON e.id = p.entry;
END;
