-- The invoice-project graft's analytical contract: which project each
-- invoice charges.
CREATE VIEW invoice_project.charges AS
SELECT c.invoice, c.project
FROM invoice_project.charge c;
