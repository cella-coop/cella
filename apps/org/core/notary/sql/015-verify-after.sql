-- The notary at 0.10.0: the log verifies a page at a time, and from a
-- checkpoint, `cella.verify_log(after)`. A database made before it is
-- upgraded in place.
ALTER EXTENSION cella UPDATE;
