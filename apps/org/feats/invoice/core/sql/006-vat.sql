-- An invoice's VAT by rate, each line's tax rounded by `cella.line_vat`, the
-- VAT core library's, as `issue` and a bill round it.
CREATE OR REPLACE VIEW invoice.taxed WITH (security_invoker = true) AS
SELECT l.invoice, l.vat_rate AS rate,
       sum(cella.cents(l.amount))::bigint AS base,
       sum(cella.line_vat(cella.cents(l.amount), l.vat_rate))::bigint AS tax
FROM invoice.line l
GROUP BY l.invoice, l.vat_rate;
