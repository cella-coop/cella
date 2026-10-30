-- The client-invoice graft's analytical contract: which client each
-- invoice is billed to.
CREATE VIEW client_invoice.billings AS
SELECT b.invoice, b.client
FROM client_invoice.billing b;
