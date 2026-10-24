-- An invoice's figures and its series are the books', not a person's.
-- The name it bills, `bill_to`, a mandatory mention the books keep ten
-- years, may be a person's: no column of an invoice says whose, so it is
-- not yet registered (see the trust doc's current limits).
COMMENT ON COLUMN invoice.series.name IS 'not personal: a numbering series'' name';
COMMENT ON COLUMN invoice.invoice.net IS 'not personal: an amount of the books';
