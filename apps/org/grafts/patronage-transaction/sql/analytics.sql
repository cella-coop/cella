-- The patronage-transaction graft's analytical contract: which entry
-- posted which distribution.
CREATE VIEW patronage_transaction.postings AS
SELECT d.entry, d.distribution
FROM patronage_transaction.distribution d;
