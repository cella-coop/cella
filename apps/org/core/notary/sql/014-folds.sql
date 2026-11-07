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
-- state before the slices that extend it, then the others, core's and
-- the feats' before the grafts', a graft joining fewer feats before one
-- joining more, as a graft extends the slices it joins, each by name.
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
  ORDER BY f.owner <> split_part(folds_of.op, ':', 1), cardinality(string_to_array(f.owner, '-')), f.owner;
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
-- payload as the log keeps it, a forgone one by none, the log's first
-- entry once the rows it carries are in (`cella.fold_carried`), and an
-- entry that erases after its folds, as its write erased once its state
-- was in (`cella.fold_erasures`). One write per
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
    IF e.n = 1 AND e.settled AND e.form -> 'carried' IS NOT NULL THEN
      PERFORM cella.fold_carried(e.n, e.form -> 'carried');
    END IF;
    IF e.settled THEN
      FOR f IN SELECT x.schema, x.name FROM cella.folds_of(e.op, e.n) x LOOP
        EXECUTE pg_catalog.format('SELECT %I.%I($1)', f.schema, f.name)
          USING pg_catalog.jsonb_build_object('n', e.n, 'op', e.op, 'actor', e.actor, 'date', e.date, 'cause', e.cause, 'payload', e.form);
      END LOOP;
      PERFORM cella.fold_erasures(e.n, e.form);
    END IF;
  END LOOP;
  IF upto > at THEN
    INSERT INTO cella.fold_head (n) VALUES (upto) ON CONFLICT (one) DO UPDATE SET n = excluded.n;
  END IF;
  COMMIT;
END
$$;
REVOKE EXECUTE ON PROCEDURE cella.fold_log(bigint) FROM PUBLIC;

-- The generated columns of a table, as an array literal, or null where it
-- has none: its row computes them, so neither a carry nor a state hash
-- reads them.
CREATE FUNCTION cella.generated(schema text, tab text) RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT '{' || string_agg(a.attname::text, ',' ORDER BY a.attnum) || '}'
  FROM pg_attribute a
  WHERE a.attrelid = format('%I.%I', generated.schema, generated.tab)::regclass
    AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated <> '';
END;
REVOKE EXECUTE ON FUNCTION cella.generated(text, text) FROM PUBLIC;

-- The commitments a fold applied, each personal value of an entry by its
-- field and subject: a folded scope's vault is empty, and its personal
-- columns hold commitments it cannot open, so the state hash and the
-- compare read them here (`cella.committed`).
CREATE TABLE cella.commitment (
  field text NOT NULL,
  subject text NOT NULL,
  n bigint NOT NULL CHECK (n > 0),
  commitment bytea NOT NULL CHECK (length(commitment) = 32),
  PRIMARY KEY (field, subject, n, commitment)
);
REVOKE ALL ON cella.commitment FROM PUBLIC;
GRANT SELECT ON cella.commitment TO PUBLIC;

-- A personal value of entry `n` as a fold writes it: its commitment,
-- `{"$commit": hex}` as the log keeps it, recorded in `cella.commitment`,
-- and the column's value answered as `redacted`, since a folded scope
-- opens no commitment; a value the log keeps as null, `null`. A value the
-- log keeps plain refuses, naming its field, since the log holds no
-- personal value. A superuser's, as the fold is.
CREATE FUNCTION cella.commits(field text, subject text, n bigint, logged jsonb) RETURNS text
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF logged IS NULL OR jsonb_typeof(logged) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(logged) <> 'object' OR logged -> '$commit' IS NULL THEN
    RAISE EXCEPTION 'cella: entry % keeps the % of % as %, not as its commitment', n, field, subject, logged;
  END IF;
  INSERT INTO cella.commitment (field, subject, n, commitment)
  VALUES (commits.field, commits.subject, commits.n, decode(logged ->> '$commit', 'hex'))
  ON CONFLICT DO NOTHING;
  RETURN 'redacted';
END
$$;
REVOKE EXECUTE ON FUNCTION cella.commits(text, text, bigint, jsonb) FROM PUBLIC;

-- A personal column's value as the log holds it: the newest commitment the
-- vault keeps for its field and subject, in hex, or in a folded scope,
-- whose vault is empty, the newest the fold applied (`cella.commitment`),
-- the greatest of one entry's; or the value itself where neither keeps
-- one: a value never committed, or one erasure redacted, whose commitments
-- went with its keys. So a folded column, `redacted` or null where its
-- handler wrote a value, reads as the source's does. The owner's, as the
-- vault is.
CREATE FUNCTION cella.committed(field text, subject text, value text) RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT coalesce((SELECT encode(s.commitment, 'hex') FROM vault.secret s
                   WHERE s.field = committed.field AND s.subject = committed.subject
                   ORDER BY s.receipt DESC, s.commitment DESC LIMIT 1),
                  (SELECT encode(c.commitment, 'hex') FROM cella.commitment c
                   WHERE c.field = committed.field AND c.subject = committed.subject
                   ORDER BY c.n DESC, c.commitment DESC LIMIT 1),
                  committed.value);
END;
REVOKE EXECUTE ON FUNCTION cella.committed(text, text, text) FROM PUBLIC;

-- The erasures entry `n` carried out, each `$erasure` its payload keeps,
-- as the notary did once the write's state was in: each class it erased
-- of its subject loses the commitments the fold applied, as the vault
-- loses its keys and their values, and its columns are redacted by
-- `cella.redact`, as the notary redacts them; a class only restricted
-- keeps both. A superuser's, run by `cella.fold_log`.
CREATE FUNCTION cella.fold_erasures(n bigint, form jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  e jsonb;
  k text;
BEGIN
  FOR e IN SELECT x FROM jsonb_path_query(form, 'strict $.**."$erasure"') x LOOP
    FOR k IN SELECT jsonb_array_elements_text(e -> 'erased') LOOP
      DELETE FROM cella.commitment c
      WHERE c.subject = e ->> 'subject'
        AND c.field IN (SELECT p.schema || '.' || p.tab || '.' || p.col FROM cella.personal p WHERE p.class = k);
      PERFORM cella.redact(e ->> 'subject', k);
    END LOOP;
  END LOOP;
END
$$;
REVOKE EXECUTE ON FUNCTION cella.fold_erasures(bigint, jsonb) FROM PUBLIC;

-- The state a scope held before its log, as its founding carries it: the
-- rows of every registered state table, by the table's name, an empty one
-- too, each row as
-- JSON with its generated columns left out and each personal value
-- marked `$personal`, so the log keeps its commitment and the vault its
-- value; and the value each sequence of their schemas reached. Read
-- inside the founding's write, once its state is in: the app's, which
-- founds.
CREATE FUNCTION cella.carry() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  t record;
  personal text;
  texts text;
  generated text;
  rows jsonb;
  tables jsonb := '[]';
BEGIN
  FOR t IN SELECT s.schema, s.tab FROM cella.state s
           WHERE (SELECT c.relkind FROM pg_class c WHERE c.oid = to_regclass(format('%I.%I', s.schema, s.tab))) = 'r'
           ORDER BY s.schema COLLATE "C", s.tab COLLATE "C" LOOP
    -- A decimal or a JSON value is carried as its text, since a payload
    -- holds no float.
    SELECT string_agg(format(
             '%L, CASE WHEN x.%I IS NULL OR x.%I IS NULL THEN %s ELSE jsonb_build_object(''$personal'', jsonb_build_object(''field'', %L, ''subject'', x.%I::text, ''value'', %s)) END',
             p.col, p.col, p.subject, v.json, p.schema || '.' || p.tab || '.' || p.col, p.subject, v.json), ', ' ORDER BY p.col)
      INTO personal
      FROM cella.personal p
      JOIN pg_attribute a ON a.attrelid = format('%I.%I', p.schema, p.tab)::regclass AND a.attname = p.col
      JOIN pg_type y ON y.oid = a.atttypid
      CROSS JOIN LATERAL (SELECT CASE WHEN coalesce(nullif(y.typbasetype, 0), y.oid) IN ('numeric'::regtype, 'real'::regtype, 'double precision'::regtype, 'json'::regtype, 'jsonb'::regtype)
                                 THEN format('to_jsonb(x.%I::text)', p.col) ELSE format('to_jsonb(x.%I)', p.col) END AS json) v
      WHERE p.schema = t.schema AND p.tab = t.tab;
    SELECT string_agg(format('%L, x.%I::text', a.attname, a.attname), ', ' ORDER BY a.attnum)
      INTO texts
      FROM pg_attribute a JOIN pg_type y ON y.oid = a.atttypid
      WHERE a.attrelid = format('%I.%I', t.schema, t.tab)::regclass AND a.attnum > 0 AND NOT a.attisdropped
        AND coalesce(nullif(y.typbasetype, 0), y.oid) IN ('numeric'::regtype, 'real'::regtype, 'double precision'::regtype, 'json'::regtype, 'jsonb'::regtype)
        AND NOT EXISTS (SELECT FROM cella.personal p WHERE p.schema = t.schema AND p.tab = t.tab AND p.col = a.attname);
    generated := cella.generated(t.schema, t.tab);
    EXECUTE format(
      'SELECT coalesce(jsonb_agg(y.r ORDER BY y.r::text COLLATE "C"), ''[]'') FROM (SELECT to_jsonb(x)%s%s%s AS r FROM ONLY %I.%I x) y',
      CASE WHEN generated IS NULL THEN '' ELSE format(' - %L::text[]', generated) END,
      CASE WHEN texts IS NULL THEN '' ELSE ' || jsonb_build_object(' || texts || ')' END,
      CASE WHEN personal IS NULL THEN '' ELSE ' || jsonb_build_object(' || personal || ')' END,
      t.schema, t.tab) INTO rows;
    tables := tables || jsonb_build_array(jsonb_build_object('table', t.schema || '.' || t.tab, 'rows', rows));
  END LOOP;
  RETURN jsonb_build_object('tables', tables, 'sequences', (
    SELECT coalesce(jsonb_object_agg(q.schemaname || '.' || q.sequencename, q.last_value), '{}')
    FROM pg_sequences q
    WHERE q.last_value IS NOT NULL AND q.schemaname IN (SELECT s.schema FROM cella.state s)));
END
$$;
REVOKE EXECUTE ON FUNCTION cella.carry() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cella.carry() TO cella_app;

-- Applies the rows the founding, entry `n`, carries, before its folds: as
-- a replica loads a snapshot, with no trigger and no key checked, since
-- the founding wrote them under both, each table's in place of what
-- the migrations wrote there, as the founding held it whole; each JSON
-- value parsed from the text it came as; each personal value by its
-- commitment (`cella.commits`), as `redacted`
-- where its column is text or JSON, else null where it takes one, as a
-- file's bytes do, and one, the least amount, where it is a number that
-- takes none; a value with no subject, which is no one's, as it came;
-- and each sequence at the value it reached. A superuser's, run by
-- `cella.fold_log`.
CREATE FUNCTION cella.fold_carried(n bigint, carried jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  t jsonb;
  rel regclass;
  rows jsonb;
  p record;
  cols text;
  q record;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  FOR t IN SELECT x FROM jsonb_array_elements(carried -> 'tables') x LOOP
    rel := (t ->> 'table')::regclass;
    rows := t -> 'rows';
    FOR p IN SELECT c.col, c.subject, c.schema || '.' || c.tab || '.' || c.col AS field, format_type(a.atttypid, NULL) AS type, a.attnotnull AS required
             FROM cella.personal c
             JOIN pg_attribute a ON a.attrelid = rel AND a.attname = c.col
             WHERE format('%I.%I', c.schema, c.tab)::regclass = rel LOOP
      SELECT jsonb_agg(e.r || jsonb_build_object(p.col, CASE
               WHEN e.r ->> p.subject IS NULL THEN e.r -> p.col
               WHEN h.v IS NULL THEN NULL
               WHEN p.type IN ('text', 'character varying', 'jsonb', 'json') THEN to_jsonb(h.v)
               WHEN NOT p.required THEN NULL
               ELSE to_jsonb(1) END) ORDER BY e.i)
        INTO rows
        FROM jsonb_array_elements(rows) WITH ORDINALITY e(r, i)
        CROSS JOIN LATERAL (SELECT CASE WHEN e.r ->> p.subject IS NOT NULL THEN cella.commits(p.field, e.r ->> p.subject, n, e.r -> p.col) END AS v) h;
    END LOOP;
    -- A JSON column came as its text, a personal one as its commitment.
    FOR p IN SELECT a.attname::text AS col
             FROM pg_attribute a JOIN pg_type y ON y.oid = a.atttypid
             WHERE a.attrelid = rel AND a.attnum > 0 AND NOT a.attisdropped
               AND coalesce(nullif(y.typbasetype, 0), y.oid) IN ('json'::regtype, 'jsonb'::regtype) LOOP
      SELECT jsonb_agg(CASE WHEN jsonb_typeof(e.r -> p.col) = 'string' AND NOT EXISTS (
                              SELECT FROM cella.personal c WHERE format('%I.%I', c.schema, c.tab)::regclass = rel AND c.col = p.col AND e.r ->> c.subject IS NOT NULL)
                            THEN e.r || jsonb_build_object(p.col, (e.r ->> p.col)::jsonb) ELSE e.r END ORDER BY e.i)
        INTO rows
        FROM jsonb_array_elements(rows) WITH ORDINALITY e(r, i);
    END LOOP;
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) INTO cols
      FROM pg_attribute a WHERE a.attrelid = rel AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '';
    EXECUTE format('DELETE FROM ONLY %s', rel);
    EXECUTE format('INSERT INTO %s (%s) OVERRIDING SYSTEM VALUE SELECT %s FROM jsonb_populate_recordset(NULL::%s, $1)', rel, cols, cols, rel)
      USING rows;
  END LOOP;
  FOR q IN SELECT x.key, x.value FROM jsonb_each(carried -> 'sequences') x LOOP
    PERFORM setval(q.key::regclass, q.value::bigint, true);
  END LOOP;
  PERFORM set_config('session_replication_role', 'origin', true);
END
$$;
REVOKE EXECUTE ON FUNCTION cella.fold_carried(bigint, jsonb) FROM PUBLIC;

-- The rows of every registered state table of the schemas named, in the
-- canonical order the state hash reads: each table by its name, bytewise,
-- its rows as JSON text sorted bytewise, a personal column as
-- `cella.committed` gives it, and a generated column left out, since its
-- row computes it, as a file's hash is its bytes'. A partition's rows are
-- its own, never its parent's again. The owner's.
CREATE FUNCTION cella.state_rows(schemas text[]) RETURNS TABLE (tab text, r text)
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  t record;
  personal text;
  generated text;
BEGIN
  FOR t IN SELECT s.schema, s.tab FROM cella.state s WHERE s.schema = ANY (schemas)
             AND (SELECT c.relkind FROM pg_class c WHERE c.oid = to_regclass(format('%I.%I', s.schema, s.tab))) = 'r'
           ORDER BY s.schema COLLATE "C", s.tab COLLATE "C" LOOP
    SELECT string_agg(format('%L, cella.committed(%L, x.%I::text, x.%I::text)', p.col, p.schema || '.' || p.tab || '.' || p.col, p.subject, p.col), ', ' ORDER BY p.col)
      INTO personal
      FROM cella.personal p WHERE p.schema = t.schema AND p.tab = t.tab;
    generated := cella.generated(t.schema, t.tab);
    RETURN QUERY EXECUTE format(
      'SELECT %L::text, y.r FROM (SELECT (to_jsonb(x)%s%s)::text AS r FROM ONLY %I.%I x) y ORDER BY y.r COLLATE "C"',
      t.schema || '.' || t.tab,
      CASE WHEN generated IS NULL THEN '' ELSE format(' - %L::text[]', generated) END,
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
