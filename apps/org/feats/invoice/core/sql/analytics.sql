-- The invoice feat's analytical contract: each invoice with its figures
-- and standing, its VAT by rate, and its payments. Whom it is billed to is
-- contact-invoice's. A contract reads tables, never `invoice.standing` or
-- `invoice.taxed`, which read as their reader: the standing and the VAT
-- are read here as there.
CREATE VIEW invoice.invoices AS
SELECT i.id, i.series, i.number, i.issued, i.due, cella.cents(i.net) AS net, cella.cents(i.vat) AS vat,
       cella.cents(i.total) AS total, i.sent, i.voided, p.paid,
       CASE WHEN i.voided IS NOT NULL THEN 0
            ELSE greatest(cella.cents(i.total) - p.paid, 0) END AS owed,
       CASE WHEN i.voided IS NOT NULL THEN p.paid
            ELSE greatest(p.paid - cella.cents(i.total), 0) END AS credit,
       CASE WHEN i.voided IS NOT NULL THEN 'voided'
            WHEN p.paid = 0 THEN 'unpaid'
            WHEN p.paid < cella.cents(i.total) THEN 'partial'
            WHEN p.paid = cella.cents(i.total) THEN 'paid'
            ELSE 'overpaid' END AS state,
       i.circle
FROM invoice.invoice i
CROSS JOIN LATERAL (
  SELECT coalesce(sum(cella.cents(x.amount)), 0)::bigint AS paid FROM invoice.payment x WHERE x.invoice = i.id
) p;
COMMENT ON VIEW invoice.invoices IS 'audience: scoped by circle';

CREATE VIEW invoice.taxes AS
SELECT t.invoice, t.rate, t.base, t.tax, i.circle
FROM invoice.invoice i
CROSS JOIN LATERAL (
  SELECT l.invoice, l.vat_rate AS rate, sum(cella.cents(l.amount))::bigint AS base,
         sum(cella.line_vat(cella.cents(l.amount), l.vat_rate))::bigint AS tax
  FROM invoice.line l
  WHERE l.invoice = i.id
  GROUP BY l.invoice, l.vat_rate
) t;
COMMENT ON VIEW invoice.taxes IS 'audience: scoped by circle';

CREATE VIEW invoice.payments AS
SELECT p.id, p.invoice, p.at, cella.cents(p.amount) AS amount, p.method, p.circle
FROM invoice.payment p;
COMMENT ON VIEW invoice.payments IS 'audience: scoped by circle';
