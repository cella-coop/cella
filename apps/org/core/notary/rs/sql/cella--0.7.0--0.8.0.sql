-- cella 0.7.0 to 0.8.0: a decision carries its effects in its own
-- transaction. An effect is an entry with no receipt, naming in its place
-- the entry of its own write it follows, by number and hash, and whether
-- it settled or was forgone; `cella.follows` says which op may follow
-- which, and whether the cause stands only with the effect, from the
-- entry after the row was registered on. Every entry
-- the log holds is a decision and keeps its receipt. `ALTER EXTENSION
-- cella UPDATE` runs it, with the 0.8.0 library loaded.

ALTER TABLE cella.log
    ALTER COLUMN receipt DROP NOT NULL,
    ADD COLUMN cause bigint REFERENCES cella.log,
    ADD COLUMN cause_hash bytea,
    ADD COLUMN settled boolean NOT NULL DEFAULT true,
    ADD CONSTRAINT log_basis CHECK (CASE WHEN cause IS NULL THEN receipt IS NOT NULL AND cause_hash IS NULL AND settled
                                         ELSE receipt IS NULL AND cause < n AND length(cause_hash) = 32 END);

CREATE TABLE cella.follows (
    cause text NOT NULL,
    op text NOT NULL,
    owner text NOT NULL,
    required boolean NOT NULL DEFAULT false,
    since bigint NOT NULL CHECK (since > 0),
    PRIMARY KEY (cause, op)
);
CREATE FUNCTION cella.lets_follow(cause text, op text, owner text, required boolean DEFAULT false) RETURNS void
LANGUAGE sql SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  INSERT INTO cella.follows (cause, op, owner, required, since)
  VALUES (lets_follow.cause, lets_follow.op, lets_follow.owner, lets_follow.required, coalesce((SELECT h.n FROM cella.head h), 0) + 1)
  ON CONFLICT ON CONSTRAINT follows_pkey DO UPDATE SET owner = excluded.owner, required = excluded.required,
    since = CASE WHEN follows.required = excluded.required THEN follows.since ELSE excluded.since END;
END;
REVOKE ALL ON cella.follows FROM PUBLIC;
GRANT SELECT ON cella.follows TO PUBLIC;
REVOKE EXECUTE ON FUNCTION cella.lets_follow(text, text, text, boolean) FROM PUBLIC;
SELECT pg_catalog.pg_extension_config_dump('cella.follows', '');

CREATE FUNCTION cella.follow(op text, payload jsonb, cause bigint)
RETURNS TABLE (verdict bigint, state text, reason text)
STRICT VOLATILE SECURITY DEFINER
SET search_path TO pg_catalog, pg_temp
LANGUAGE c
AS 'MODULE_PATHNAME', 'follow_wrapper';

CREATE FUNCTION cella.forgo(op text, cause bigint, why text)
RETURNS TABLE (verdict bigint, state text, reason text)
STRICT VOLATILE SECURITY DEFINER
SET search_path TO pg_catalog, pg_temp
LANGUAGE c
AS 'MODULE_PATHNAME', 'forgo_wrapper';

CREATE FUNCTION cella.cause() RETURNS bigint
STRICT STABLE
LANGUAGE c
AS 'MODULE_PATHNAME', 'cause_wrapper';
