-- The expense-transaction graft's analytical contract: which entry posted
-- which expense, and on what event.
CREATE VIEW expense_transaction.postings AS
SELECT p.entry, p.expense, p.event, p.circle
FROM expense_transaction.posting p;
COMMENT ON VIEW expense_transaction.postings IS 'audience: scoped by circle';
