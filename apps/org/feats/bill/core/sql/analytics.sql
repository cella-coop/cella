-- The bill feat's analytical contract: each supplier's bill with its
-- figures and lifecycle, and its VAT by rate. A contract reads tables,
-- never `bill.taxed`, which reads as its reader: the VAT is summed here
-- as there.
CREATE VIEW bill.bills AS
SELECT b.id, b.supplier, b.reference, b.issued, b.due, b.category,
       cella.cents(b.net) AS net, cella.cents(b.vat) AS vat, cella.cents(b.total) AS total,
       b.status, b.recorded, b.approved, b.paid, b.circle
FROM bill.bill b;
COMMENT ON VIEW bill.bills IS 'audience: scoped by circle';

CREATE VIEW bill.taxes AS
SELECT t.bill, t.rate, t.base, t.tax, b.circle
FROM bill.bill b
CROSS JOIN LATERAL (
  SELECT l.bill, l.vat_rate AS rate, sum(cella.cents(l.amount))::bigint AS base,
         sum(cella.line_vat(cella.cents(l.amount), l.vat_rate))::bigint AS tax
  FROM bill.line l
  WHERE l.bill = b.id
  GROUP BY l.bill, l.vat_rate
) t;
COMMENT ON VIEW bill.taxes IS 'audience: scoped by circle';
