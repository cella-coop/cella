-- The notary at 0.9.0: each vault key names the wrap key that sealed it,
-- by its id, so a restore opens each under its own key file and names one
-- it lacks. A database made before it is upgraded in place, each vault key
-- named by the wrap key that opens it.
ALTER EXTENSION cella UPDATE;
