-- The invoice-project graft's analytical contract: which project each
-- invoice charges.
CREATE VIEW invoice_project.charges AS
SELECT c.invoice, c.project
FROM invoice_project.charge c;

-- What each project invoiced, net of VAT and of its voided invoices.
CREATE VIEW invoice_project.totals AS
SELECT i.project, i.net
FROM invoice_project.invoiced i;
