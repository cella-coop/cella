-- A bill's figures are the books', not a person's. The supplier it names,
-- a mention the books keep ten years, may be a person, a sole trader: no
-- column of a bill says whose, so it is not yet registered, as an
-- invoice's `bill_to` is not (see the trust doc's current limits).
COMMENT ON COLUMN bill.bill.net IS 'not personal: an amount of the books';
