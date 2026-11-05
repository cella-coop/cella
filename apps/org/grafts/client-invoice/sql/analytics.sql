-- The client-invoice graft's analytical contract: which client each
-- invoice is billed to.
CREATE VIEW client_invoice.billings AS
SELECT b.invoice, b.client, b.circle
FROM client_invoice.billing b;
COMMENT ON VIEW client_invoice.billings IS 'audience: scoped by circle';
