-- The notary at 0.11.0: a receipt keeps the entry that names it, so a
-- verification from a checkpoint reads no receipt before it. A database
-- made before it is upgraded in place.
ALTER EXTENSION cella UPDATE;
