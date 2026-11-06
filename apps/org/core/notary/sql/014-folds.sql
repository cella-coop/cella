-- The folds: how each action's entry applies to the state before it, so
-- the log folded entry by entry into an empty database rebuilds the
-- scope's non-personal state (architecture.md, "Folds"). Org's core keeps
-- them beside the notary, as it keeps who reads, so the extension ships no
-- new version for them: `cella.fold` registers each action's fold by the
-- slice that owns it and its version, `cella.fold_log` applies the log's
-- entries by them as `cella fold` streams it into a fresh database, and
-- `cella.checkpoint` keeps the state hash it reached every so many entries.

-- Each slice's fold of an action, by version: a changed fold is a new
-- version registered beside the old, which is kept, and an entry folds by
-- each owner's version in force at its number, the newest whose `since`
-- it has reached, `since` the first entry after it was registered.
CREATE TABLE cella.fold (
  op text NOT NULL,
  owner text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  fn regprocedure NOT NULL,
  since bigint NOT NULL CHECK (since > 0),
  PRIMARY KEY (op, owner, version)
);
REVOKE ALL ON cella.fold FROM PUBLIC;
GRANT SELECT ON cella.fold TO PUBLIC;

-- Registers a slice's fold of an action, a superuser's, from its
-- migration: a function of the entry alone, `(entry jsonb) RETURNS void`.
-- A version registered again keeps its `since`, since the migrations are
-- rewritten in place until launch.
CREATE FUNCTION cella.lets_fold(op text, version integer, fn regprocedure, owner text) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_proc p WHERE p.oid = fn AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
                 AND p.prorettype = 'void'::regtype AND p.prokind = 'f') THEN
    RAISE EXCEPTION 'cella.lets_fold: % is no fold, a function (entry jsonb) RETURNS void', fn;
  END IF;
  INSERT INTO cella.fold (op, owner, version, fn, since)
  VALUES (lets_fold.op, lets_fold.owner, lets_fold.version, lets_fold.fn, coalesce((SELECT h.n FROM cella.head h), 0) + 1)
  ON CONFLICT ON CONSTRAINT fold_pkey DO UPDATE SET fn = excluded.fn;
END
$$;
REVOKE EXECUTE ON FUNCTION cella.lets_fold(text, integer, regprocedure, text) FROM PUBLIC;

-- The folds entry `n` of `op` runs, in order: each owner's version in
-- force at `n`, the action's own slice's first, as its handler writes its
-- state before the slices that extend it, then the others by name.
CREATE FUNCTION cella.folds_of(op text, n bigint) RETURNS TABLE (owner text, version integer, schema text, name text)
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT f.owner, f.version, f.schema, f.name
  FROM (
    SELECT DISTINCT ON (x.owner) x.owner, x.version, s.nspname::text AS schema, p.proname::text AS name
    FROM cella.fold x
    JOIN pg_proc p ON p.oid = x.fn
    JOIN pg_namespace s ON s.oid = p.pronamespace
    WHERE x.op = folds_of.op AND x.since <= folds_of.n
    ORDER BY x.owner, x.since DESC, x.version DESC
  ) f
  ORDER BY f.owner <> split_part(folds_of.op, ':', 1), f.owner;
END;

-- How far the fold has applied the log in this database, and the
-- checkpoints it recorded: at entry `n`, whose hash is `hash`, the state
-- hash `state`, the BLAKE3 of the folded slices' rows as `cella fold`
-- reads them from `cella.state_rows`.
CREATE TABLE cella.fold_head (
  one boolean PRIMARY KEY DEFAULT true CHECK (one),
  n bigint NOT NULL CHECK (n > 0)
);
CREATE TABLE cella.checkpoint (
  n bigint PRIMARY KEY CHECK (n > 0),
  hash bytea NOT NULL CHECK (length(hash) = 32),
  state bytea NOT NULL CHECK (length(state) = 32)
);
REVOKE ALL ON cella.fold_head, cella.checkpoint FROM PUBLIC;
GRANT SELECT ON cella.fold_head, cella.checkpoint TO PUBLIC;

-- Applies the log copied into this database, from the entry after the
-- fold's head through `upto`, the end of a write: each settled entry by
-- its folds, the entry as `{n, op, actor, date, cause, payload}`, its
-- payload as the log keeps it, a forgone one by none. One write per
-- transaction, a decision and the effects after it, committed with the
-- fold's head, so the verdict date each reads is its entry's and a fold
-- that fails leaves the head at the last write folded whole. A
-- superuser's, run by `cella fold` with `cella.unbound` set; a procedure
-- that commits takes no `SET`, so every name in it is qualified.
CREATE PROCEDURE cella.fold_log(upto bigint)
LANGUAGE plpgsql AS $$
DECLARE
  at bigint := coalesce((SELECT h.n FROM cella.fold_head h), 0);
  e record;
  f record;
BEGIN
  IF upto > coalesce((SELECT max(l.n) FROM cella.log l), 0) THEN
    RAISE EXCEPTION 'cella.fold_log: the log here holds no entry %', upto;
  END IF;
  FOR i IN at + 1 .. upto LOOP
    SELECT l.n, l.op, l.actor, l.date, l.form, l.receipt, l.cause, l.settled INTO e FROM cella.log l WHERE l.n = i;
    IF e.receipt IS NULL AND i = at + 1 THEN
      RAISE EXCEPTION 'cella.fold_log: entry % is an effect of entry %, so a fold resumes at the start of its write', i, e.cause;
    END IF;
    IF e.receipt IS NOT NULL AND i > at + 1 THEN
      INSERT INTO cella.fold_head (n) VALUES (i - 1) ON CONFLICT (one) DO UPDATE SET n = excluded.n;
      COMMIT;
    END IF;
    PERFORM pg_catalog.set_config('cella.clock', e.date::text, true);
    IF e.settled THEN
      FOR f IN SELECT x.schema, x.name FROM cella.folds_of(e.op, e.n) x LOOP
        EXECUTE pg_catalog.format('SELECT %I.%I($1)', f.schema, f.name)
          USING pg_catalog.jsonb_build_object('n', e.n, 'op', e.op, 'actor', e.actor, 'date', e.date, 'cause', e.cause, 'payload', e.form);
      END LOOP;
    END IF;
  END LOOP;
  IF upto > at THEN
    INSERT INTO cella.fold_head (n) VALUES (upto) ON CONFLICT (one) DO UPDATE SET n = excluded.n;
  END IF;
  COMMIT;
END
$$;
REVOKE EXECUTE ON PROCEDURE cella.fold_log(bigint) FROM PUBLIC;

-- A personal column's value as the log holds it: the newest commitment the
-- vault keeps for its field and subject, in hex, or the value itself where
-- the vault keeps none, as in a folded scope, whose column holds the
-- commitment, or where erasure redacted it. The owner's, as the vault is.
CREATE FUNCTION cella.committed(field text, subject text, value text) RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT CASE WHEN committed.value IS NULL OR committed.value IN ('redacted', '"redacted"') THEN committed.value
    ELSE coalesce((SELECT encode(s.commitment, 'hex') FROM vault.secret s
                   WHERE s.field = committed.field AND s.subject = committed.subject
                   ORDER BY s.receipt DESC LIMIT 1), committed.value) END;
END;
REVOKE EXECUTE ON FUNCTION cella.committed(text, text, text) FROM PUBLIC;

-- The rows of every registered state table of the schemas named, in the
-- canonical order the state hash reads: each table by its name, bytewise,
-- its rows as JSON text sorted bytewise, a personal column as
-- `cella.committed` gives it. A partition's rows are its own, never its
-- parent's again. The owner's.
CREATE FUNCTION cella.state_rows(schemas text[]) RETURNS TABLE (tab text, r text)
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  t record;
  personal text;
BEGIN
  FOR t IN SELECT s.schema, s.tab FROM cella.state s WHERE s.schema = ANY (schemas)
           ORDER BY s.schema COLLATE "C", s.tab COLLATE "C" LOOP
    SELECT string_agg(format('%L, cella.committed(%L, x.%I::text, x.%I::text)', p.col, p.schema || '.' || p.tab || '.' || p.col, p.subject, p.col), ', ' ORDER BY p.col)
      INTO personal
      FROM cella.personal p WHERE p.schema = t.schema AND p.tab = t.tab;
    RETURN QUERY EXECUTE format(
      'SELECT %L::text, y.r FROM (SELECT (to_jsonb(x)%s)::text AS r FROM ONLY %I.%I x) y ORDER BY y.r COLLATE "C"',
      t.schema || '.' || t.tab,
      CASE WHEN personal IS NULL THEN '' ELSE ' || jsonb_build_object(' || personal || ')' END,
      t.schema, t.tab);
  END LOOP;
END
$$;
REVOKE EXECUTE ON FUNCTION cella.state_rows(text[]) FROM PUBLIC;

-- Each slice's schema among the registered state tables, whether it is
-- folded, and the actions of it with no fold: a slice is folded when it
-- registers a fold and every action of it, by the slice its id names,
-- among those the scope registers or its log holds, has one.
CREATE FUNCTION cella.folded() RETURNS TABLE (schema text, folded boolean, unfolded text[])
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  WITH ops AS (
    SELECT p.op FROM cella.power p
    UNION SELECT f.op FROM cella.fold f
    UNION SELECT f.op FROM cella.follows f
    UNION SELECT f.cause FROM cella.follows f
    UNION SELECT DISTINCT l.op FROM cella.log l
  ), slices AS (
    SELECT DISTINCT s.schema FROM cella.state s
  )
  SELECT sl.schema,
         EXISTS (SELECT FROM cella.fold f WHERE replace(f.owner, '-', '_') = sl.schema) AND u.ops IS NULL,
         coalesce(u.ops, '{}')
  FROM slices sl
  LEFT JOIN LATERAL (
    SELECT array_agg(o.op ORDER BY o.op) AS ops FROM ops o
    WHERE replace(split_part(o.op, ':', 1), '-', '_') = sl.schema
      AND NOT EXISTS (SELECT FROM cella.fold f WHERE f.op = o.op)
  ) u ON true
  ORDER BY sl.schema;
END;
