-- The invoice-transaction graft's analytical contract: which entry posted
-- which invoice or payment, and on what event.
CREATE VIEW invoice_transaction.postings AS
SELECT p.entry, p.invoice, p.event, p.payment, p.circle
FROM invoice_transaction.posting p;
COMMENT ON VIEW invoice_transaction.postings IS 'audience: scoped by circle';
