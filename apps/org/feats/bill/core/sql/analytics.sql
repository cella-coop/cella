-- The bill feat's analytical contract: each supplier's bill with its
-- figures and lifecycle, and its VAT by rate.
CREATE VIEW bill.bills AS
SELECT b.id, b.supplier, b.reference, b.issued, b.due, b.category,
       cella.cents(b.net) AS net, cella.cents(b.vat) AS vat, cella.cents(b.total) AS total,
       b.status, b.recorded, b.approved, b.paid
FROM bill.bill b;

CREATE VIEW bill.taxes AS
SELECT t.bill, t.rate, t.base, t.tax
FROM bill.taxed t;
