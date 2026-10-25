-- account-transaction:entry:carry — an entry carried over from the books
-- of the co-op's last tool, such as the à-nouveaux entry of its opening
-- balances: the entry the payload names, on its date and with its lines,
-- and each account it opened, as the payload names them, in the chart and
-- of the kind its code's class makes it. Unlike a post it may touch a
-- cash account, since it records money that moved before cella, not money
-- moving now; so it needs a power of its own, `carry-books`, which no
-- mandate that keeps the books grants by itself. The journal's triggers
-- still refuse an entry that does not balance or falls in no open period.
CREATE FUNCTION account_transaction.carries(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    CASE
      WHEN e.id IS NULL THEN 'no entry ' || coalesce(x.entry, 'is named')
      WHEN e.date IS DISTINCT FROM x.date
        OR (SELECT count(*) FROM transaction.line l WHERE l.entry = e.id) IS DISTINCT FROM jsonb_array_length(coalesce(payload -> 'lines', '[]'::jsonb))::bigint
        OR (SELECT sum(cella.cents(l.amount)) FROM transaction.line l WHERE l.entry = e.id AND l.side = 'debit')
           IS DISTINCT FROM (SELECT sum((p ->> 'cents')::bigint) FROM jsonb_array_elements(payload -> 'lines') p WHERE p ->> 'side' = 'debit')
        THEN e.id || ' is not the entry the write carried over'
    END,
    (SELECT string_agg(o.code || ' was not opened as the write names', '; ' ORDER BY o.code)
     FROM jsonb_array_elements_text(coalesce(payload -> 'opened', '[]'::jsonb)) AS o(code)
     LEFT JOIN account.account a ON a.code = o.code
     WHERE a.code IS NULL OR a.kind IS DISTINCT FROM account.kind_of(o.code))
  )
  FROM (SELECT payload ->> 'entry' AS entry, (payload ->> 'date')::date AS date) x
  LEFT JOIN transaction.entry e ON e.id = x.entry;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('account-transaction:entry:carry', 'account_transaction.carries(jsonb)', 'account-transaction');

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account-transaction:entry:carry', 'carry-books', NULL, 'account-transaction');
