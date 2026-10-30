-- The expense-transaction graft's analytical contract: which entry posted
-- which expense, and on what event.
CREATE VIEW expense_transaction.postings AS
SELECT p.entry, p.expense, p.event
FROM expense_transaction.posting p;
