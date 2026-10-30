-- The invoice feat's analytical contract: each invoice with its figures
-- and standing, its VAT by rate, and its payments. Whom it is billed to is
-- client-invoice's.
CREATE VIEW invoice.invoices AS
SELECT i.id, i.series, i.number, i.issued, i.due, cella.cents(i.net) AS net, cella.cents(i.vat) AS vat,
       cella.cents(i.total) AS total, i.sent, i.voided, s.paid, s.owed, s.credit, s.state
FROM invoice.invoice i
JOIN invoice.standing s ON s.id = i.id;

CREATE VIEW invoice.taxes AS
SELECT t.invoice, t.rate, t.base, t.tax
FROM invoice.taxed t;

CREATE VIEW invoice.payments AS
SELECT p.id, p.invoice, p.at, cella.cents(p.amount) AS amount, p.method
FROM invoice.payment p;
