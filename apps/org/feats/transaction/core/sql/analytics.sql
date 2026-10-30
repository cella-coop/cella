-- The transaction feat's analytical contract. A line on a member's
-- capital account is theirs, and only the account-transaction graft knows
-- which accounts are held, so the journal shows here only as sums over
-- every line: each month's entries and what they moved.
CREATE VIEW transaction.months AS
SELECT to_char(e.date, 'YYYY-MM') AS month,
       count(DISTINCT e.id)::bigint AS entries,
       count(*)::bigint AS lines,
       coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'debit'), 0)::bigint AS debit,
       coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'credit'), 0)::bigint AS credit
FROM transaction.entry e
JOIN transaction.line l ON l.entry = e.id
GROUP BY to_char(e.date, 'YYYY-MM');
