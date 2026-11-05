-- The patronage-transaction graft's analytical contract: which entry
-- posted which distribution.
CREATE VIEW patronage_transaction.postings AS
SELECT d.entry, d.distribution, d.circle
FROM patronage_transaction.distribution d;
COMMENT ON VIEW patronage_transaction.postings IS 'audience: scoped by circle';
