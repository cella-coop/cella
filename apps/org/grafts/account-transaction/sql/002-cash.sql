-- Money leaves a cash account only through the writes that carry their own
-- power and limit, pay and payroll, whose feat's rules check the entry is
-- exactly that. A post keeps the books and touches no cash account; a
-- correction credits one only to undo what the entry it corrects debited.

-- transaction:transaction:post — the entry posts to no cash account.
CREATE FUNCTION account_transaction.cashless(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.account IS NOT NULL
      THEN x.entry || ' posts to ' || c.account || ', a cash account: money moves through pay or payroll'
  END
  FROM (SELECT payload ->> 'entry' AS entry) x
  LEFT JOIN LATERAL (
    SELECT min(l.account) AS account
    FROM transaction.line l
    JOIN account.account a ON a.code = l.account AND a.cash
    WHERE l.entry = x.entry
  ) c ON true;
END;

-- transaction:transaction:adjust — the entry credits no cash account by
-- more than the entry it corrects debited it.
CREATE FUNCTION account_transaction.restores(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN o.account IS NOT NULL
      THEN x.entry || ' credits ' || o.account || ' beyond what ' || coalesce(x.corrects, 'no entry')
        || ' debited it: a correction returns cash, it never pays it out'
  END
  FROM (SELECT payload ->> 'entry' AS entry, payload ->> 'corrects' AS corrects) x
  LEFT JOIN LATERAL (
    SELECT min(c.account) AS account
    FROM (
      SELECT l.account, sum(cella.cents(l.amount)) AS cents
      FROM transaction.line l
      JOIN account.account a ON a.code = l.account AND a.cash
      WHERE l.entry = x.entry AND l.side = 'credit'
      GROUP BY l.account
    ) c
    WHERE c.cents > coalesce((
      SELECT sum(cella.cents(k.amount)) FROM transaction.line k
      WHERE k.entry = x.corrects AND k.account = c.account AND k.side = 'debit'
    ), 0)
  ) o ON true;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('transaction:transaction:post', 'account_transaction.cashless(jsonb)', 'account-transaction'),
  ('transaction:transaction:adjust', 'account_transaction.restores(jsonb)', 'account-transaction');
