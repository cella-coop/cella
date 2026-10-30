-- A document's lines, as every feat that bills or is billed counts them:
-- an invoice the co-op issues and a bill it receives add up alike. Pure
-- functions beside the notary's, which any feat's SQL may call.

-- A line's amount in cents: its quantity times its unit price, rounded to
-- the cent.
CREATE FUNCTION cella.line_amount(quantity numeric, unit_price bigint) RETURNS bigint
LANGUAGE sql IMMUTABLE
RETURN round(quantity * unit_price)::bigint;

-- The VAT on a line's amount at a rate in percent (5.50), rounded to the
-- cent. A document's VAT is the sum of its lines', so its VAT by rate adds
-- up to it.
CREATE FUNCTION cella.line_vat(amount bigint, rate numeric) RETURNS bigint
LANGUAGE sql IMMUTABLE
RETURN round(amount * rate / 100)::bigint;

GRANT EXECUTE ON FUNCTION cella.line_amount(numeric, bigint), cella.line_vat(bigint, numeric) TO cella_app, cella_rules;
