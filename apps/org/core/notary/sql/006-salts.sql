-- The notary at 0.3.0: each receipt keeps the salt of the request its
-- member signed, and the payload restates the request wherever it carries
-- the same field. A database made before it is upgraded in place.
ALTER EXTENSION cella UPDATE;
