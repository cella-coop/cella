-- An invoice's figures and its series are the books', not a person's.
-- The name it bills, `bill_to`, a mandatory mention the books keep ten
-- years, may be a person's, as its address may: both are registered
-- personal once the address is kept (`009-billed.sql`).
COMMENT ON COLUMN invoice.series.name IS 'not personal: a numbering series'' name';
COMMENT ON COLUMN invoice.invoice.net IS 'not personal: an amount of the books';
