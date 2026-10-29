-- The account-transaction graft's analytical contract: the journal by
-- account and day, what every statement and the trial balance sum. Each
-- line is resolved to its account; a member's capital account is summed
-- into its parent's code, so no row is one member's.
CREATE VIEW account_transaction.movements AS
SELECT CASE WHEN a.holder IS NULL THEN a.code ELSE a.parent END AS code,
       e.date AS day,
       to_char(e.date, 'YYYY-MM') AS month,
       coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'debit'), 0)::bigint AS debit,
       coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'credit'), 0)::bigint AS credit
FROM transaction.line l
JOIN transaction.entry e ON e.id = l.entry
JOIN account.account a ON a.code = l.account
GROUP BY CASE WHEN a.holder IS NULL THEN a.code ELSE a.parent END, e.date;

COMMENT ON COLUMN account_transaction.movements.code IS 'not personal: a held account is summed into its parent''s code';
