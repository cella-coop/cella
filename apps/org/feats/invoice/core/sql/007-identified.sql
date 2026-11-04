-- invoice:invoice:issue — the invoice issued names whom it bills and their
-- address, and its seller as `invoice.seller()` kept it: its legal name,
-- form, seat, SIREN and registry, and its VAT number where a line carries
-- VAT, none of them blank, holding nothing but white space (VAT directive
-- 2006/112/EC, art. 226; code de commerce L441-9 and R123-237). An issued
-- invoice is corrected only by a void, so a missing mention is kept out
-- here or not at all; the refusal names each, and the setting a host makes
-- for the seller's.
CREATE FUNCTION invoice.identified(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN i.id IS NULL THEN 'no invoice ' || coalesce(x.id, 'is named')
    WHEN cardinality(m.missing) > 0 THEN i.id || ' does not issue without ' || array_to_string(m.missing, ', ')
      || ': an issued invoice is corrected only by a void'
  END
  FROM (SELECT payload ->> 'invoice' AS id) x
  LEFT JOIN invoice.invoice i ON i.id = x.id
  LEFT JOIN LATERAL (
    SELECT array_remove(ARRAY[
      CASE WHEN coalesce(i.bill_to, '') !~ '\S' THEN 'the name it bills' END,
      CASE WHEN coalesce(i.bill_address, '') !~ '\S' THEN 'the address it bills' END,
      CASE WHEN coalesce(i.seller ->> 'name', '') !~ '\S' THEN 'the seller''s legal name (cella.scope_legal_name)' END,
      CASE WHEN coalesce(i.seller ->> 'form', '') !~ '\S' THEN 'the seller''s legal form (cella.scope_form)' END,
      CASE WHEN coalesce(i.seller ->> 'seat', '') !~ '\S' THEN 'the seller''s seat (cella.scope_seat)' END,
      CASE WHEN coalesce(i.seller ->> 'siren', '') !~ '\S' THEN 'the seller''s SIREN (cella.scope_siren)' END,
      CASE WHEN coalesce(i.seller ->> 'rcs', '') !~ '\S' THEN 'the seller''s registry (cella.scope_rcs)' END,
      CASE WHEN coalesce(i.seller ->> 'vat', '') !~ '\S'
        AND EXISTS (SELECT FROM invoice.line l WHERE l.invoice = i.id AND l.vat_rate > 0)
        THEN 'the seller''s VAT number (cella.scope_vat), as a line carries VAT' END
    ], NULL) AS missing
  ) m ON true;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('invoice:invoice:issue', 'invoice.identified(jsonb)', 'invoice');
