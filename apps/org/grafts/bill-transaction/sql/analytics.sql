-- The bill-transaction graft's analytical contract: which entry posted
-- which bill, and on what event.
CREATE VIEW bill_transaction.postings AS
SELECT p.entry, p.bill, p.event, p.circle
FROM bill_transaction.posting p;
COMMENT ON VIEW bill_transaction.postings IS 'audience: scoped by circle';
