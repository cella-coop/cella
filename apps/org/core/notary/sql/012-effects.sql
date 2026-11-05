-- The notary at 0.8.0: a decision carries its effects in its own
-- transaction, each an entry citing the entry it follows, and
-- `cella.follows` registers which op may follow which. A database made
-- before it is upgraded in place. Only the app appends an effect or
-- records one forgone, as only it submits: a guard that called either
-- would write through the extension's own rights.
ALTER EXTENSION cella UPDATE;
REVOKE EXECUTE ON FUNCTION cella.follow(text, jsonb, bigint), cella.forgo(text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cella.follow(text, jsonb, bigint), cella.forgo(text, bigint, text) TO cella_app;
