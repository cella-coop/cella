-- cella 0.11.0 to 0.12.0: the multiset hash a fold keeps of each state
-- table, LtHash16, so a checkpoint's state hash costs what changed since
-- the last one, never the state's size, and the log's index of its
-- actions, so the fold lists the actions it holds without reading it.
-- `ALTER EXTENSION cella UPDATE` runs it, with the 0.12.0 library loaded;
-- it adds functions and the index alone.

CREATE INDEX log_op ON cella.log (op);

CREATE FUNCTION cella.lthash("element" TEXT) RETURNS bytea
IMMUTABLE STRICT PARALLEL SAFE LANGUAGE c
AS 'MODULE_PATHNAME', 'lthash_wrapper';

CREATE FUNCTION cella.lthash_add("a" bytea, "b" bytea) RETURNS bytea
IMMUTABLE PARALLEL SAFE LANGUAGE c
AS 'MODULE_PATHNAME', 'lthash_add_wrapper';

CREATE FUNCTION cella.lthash_times("a" bytea, "k" bigint) RETURNS bytea
IMMUTABLE STRICT PARALLEL SAFE LANGUAGE c
AS 'MODULE_PATHNAME', 'lthash_times_wrapper';

CREATE FUNCTION cella.lthash_zero() RETURNS bytea
IMMUTABLE STRICT PARALLEL SAFE LANGUAGE c
AS 'MODULE_PATHNAME', 'lthash_zero_wrapper';

CREATE AGGREGATE cella.lthash_sum(bytea) (SFUNC = cella.lthash_add, STYPE = bytea, PARALLEL = SAFE);
