-- The contact-invoice graft's analytical contract: which contact each
-- invoice is billed to.
CREATE VIEW contact_invoice.billings AS
SELECT b.invoice, b.contact, b.circle
FROM contact_invoice.billing b;
COMMENT ON VIEW contact_invoice.billings IS 'audience: scoped by circle';
