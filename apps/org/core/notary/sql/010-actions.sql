-- The notary at 0.6.0: a guard reads the id of the action being judged
-- through `cella.action()`. A database made before it is upgraded in place.
ALTER EXTENSION cella UPDATE;
