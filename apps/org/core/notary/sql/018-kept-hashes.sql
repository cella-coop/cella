-- The notary at 0.12.0: the multiset hash, LtHash16, which the fold keeps
-- of each state table as it writes, so a checkpoint's state hash costs
-- what changed since the last one, never the state's size
-- (architecture.md, "Folds"). A database made before it is upgraded in
-- place; the rest is org core's, beside the folds.
ALTER EXTENSION cella UPDATE;

-- A table's hash is the multiset hash of its terms. A row's first term is
-- its canonical form, its row as JSON text without its generated columns,
-- each personal column `"personal"`, or null where it is a text column
-- that is null, since a payload keeps a null as null. A personal column
-- other than such a null adds a second term: `[field, subject,
-- commitment]` where the vault or the fold holds a commitment for its
-- field and subject, as `cella.committed` reads it, else `[field, the
-- row's form, its value]`. So the hash binds every row to what
-- `cella.state_rows` gives of it, and a new commitment for a subject,
-- which every row of that subject reads, changes the hash by the count of
-- those rows times the difference of two terms, never by reading them.

-- Each state table's kept hash, by name; and each personal field's count
-- of the rows of a subject a second term is the commitment's for.
CREATE TABLE cella.table_hash (
  tab text PRIMARY KEY,
  hash bytea NOT NULL CHECK (length(hash) = 2048)
) WITH (fillfactor = 50);
-- A hash is random, so it neither compresses nor leaves its row: each
-- write rewrites it in place.
ALTER TABLE cella.table_hash ALTER hash SET STORAGE PLAIN;
CREATE TABLE cella.slot (
  field text NOT NULL,
  subject text NOT NULL,
  count bigint NOT NULL,
  PRIMARY KEY (field, subject)
);
-- Each personal field's SQL summing a subject's second terms where no
-- commitment holds for it, as `cella.keep_hashes` writes it.
CREATE TABLE cella.kept_field (
  field text PRIMARY KEY,
  tab text NOT NULL,
  raw text NOT NULL
);
REVOKE ALL ON cella.table_hash, cella.slot, cella.kept_field FROM PUBLIC;
GRANT SELECT ON cella.table_hash TO PUBLIC;

-- The registered state tables of the schemas named, partitions each by
-- its own rows, by name: what the state hash covers.
CREATE FUNCTION cella.state_tables(schemas text[]) RETURNS TABLE (schema text, tab text)
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT s.schema, s.tab FROM cella.state s
  WHERE s.schema = ANY (state_tables.schemas)
    AND (SELECT c.relkind FROM pg_class c WHERE c.oid = to_regclass(format('%I.%I', s.schema, s.tab))) = 'r'
  ORDER BY s.schema COLLATE "C", s.tab COLLATE "C";
END;

-- A table's personal columns, numbered by name: each one's subject, its
-- field, and the SQL saying whether it has a second term, a text column
-- not null or any other, the row aliased x.
CREATE FUNCTION cella.personal_columns(schema text, tab text)
  RETURNS TABLE (i bigint, col text, subject text, field text, active text)
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT row_number() OVER (ORDER BY q.col), q.col, q.subject, q.schema || '.' || q.tab || '.' || q.col,
         CASE WHEN a.atttypid IN ('text'::regtype, 'varchar'::regtype) THEN format('x.%I IS NOT NULL', q.col) ELSE 'true' END
  FROM cella.personal q
  JOIN pg_attribute a ON a.attrelid = to_regclass(format('%I.%I', q.schema, q.tab)) AND a.attname = q.col
  WHERE q.schema = personal_columns.schema AND q.tab = personal_columns.tab
  ORDER BY q.col;
END;

-- The SQL of a row's canonical form, its first term, the row aliased x.
CREATE FUNCTION cella.canon(schema text, tab text) RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT format('(to_jsonb(x)%s%s)::text',
    CASE WHEN cella.generated(canon.schema, canon.tab) IS NULL THEN '' ELSE format(' - %L::text[]', cella.generated(canon.schema, canon.tab)) END,
    coalesce((SELECT ' || jsonb_build_object(' || string_agg(format('%L, CASE WHEN %s THEN ''personal'' END', q.col, q.active), ', ' ORDER BY q.col) || ')'
              FROM cella.personal_columns(canon.schema, canon.tab) q), ''));
END;

-- The SQL of a table's terms, each row of `rel`, aliased x, as one `e`:
-- `joined`, the commitments joined once by subject, as `cella.state_rows`
-- reads a whole table; else looked up row by row, as a trigger reads the
-- few rows a statement changed.
CREATE FUNCTION cella.terms(schema text, tab text, rel text, joined boolean) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  cols text := '';
  joins text := '';
  seconds text := '';
  p record;
BEGIN
  FOR p IN SELECT * FROM cella.personal_columns(schema, tab) ORDER BY i LOOP
    cols := cols || format(', %s AS a%s, x.%I::text AS w%s, x.%I::text AS r%s, %s AS s%s',
      p.active, p.i, p.subject, p.i, p.col, p.i,
      CASE WHEN joined THEN format('coalesce(v%s.c, f%s.c)', p.i, p.i)
           ELSE format('coalesce((SELECT encode(s.commitment, ''hex'') FROM vault.secret s WHERE s.field = %L AND s.subject = x.%I::text ORDER BY s.receipt DESC, s.commitment DESC LIMIT 1), (SELECT encode(c.commitment, ''hex'') FROM cella.commitment c WHERE c.field = %L AND c.subject = x.%I::text ORDER BY c.n DESC, c.commitment DESC LIMIT 1))', p.field, p.subject, p.field, p.subject) END, p.i);
    IF joined THEN
      joins := joins || format(
        ' LEFT JOIN (SELECT DISTINCT ON (s.subject) s.subject, encode(s.commitment, ''hex'') AS c FROM vault.secret s WHERE s.field = %L ORDER BY s.subject, s.receipt DESC, s.commitment DESC) v%s ON v%s.subject = x.%I::text'
        ' LEFT JOIN (SELECT DISTINCT ON (c.subject) c.subject, encode(c.commitment, ''hex'') AS c FROM cella.commitment c WHERE c.field = %L ORDER BY c.subject, c.n DESC, c.commitment DESC) f%s ON f%s.subject = x.%I::text',
        p.field, p.i, p.i, p.subject, p.field, p.i, p.i, p.subject);
    END IF;
    seconds := seconds || format(', (CASE WHEN y.a%s THEN CASE WHEN y.s%s IS NOT NULL THEN jsonb_build_array(%L::text, y.w%s, y.s%s)::text ELSE jsonb_build_array(%L::text, y.c, y.r%s)::text END END)',
      p.i, p.i, p.field, p.i, p.i, p.field, p.i);
  END LOOP;
  RETURN format(
    'SELECT t.e FROM (SELECT %s AS c%s FROM %s x%s) y CROSS JOIN LATERAL (VALUES (y.c)%s) t(e) WHERE t.e IS NOT NULL',
    cella.canon(schema, tab), cols, rel, joins, seconds);
END
$$;

-- The SQL adding `k`, an SQL expression, to the count of each subject's rows of `rel` for each
-- personal field of a table, or null where it has none.
CREATE FUNCTION cella.slots(schema text, tab text, rel text, k text) RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT 'INSERT INTO cella.slot (field, subject, count) SELECT f, w, sum(k) FROM ('
         || string_agg(format('SELECT %L::text AS f, x.%I::text AS w, %s AS k FROM %s x WHERE %s AND x.%I IS NOT NULL',
                              p.field, p.subject, slots.k, slots.rel, p.active, p.subject), ' UNION ALL ' ORDER BY p.i)
         || ') z GROUP BY f, w ON CONFLICT (field, subject) DO UPDATE SET count = cella.slot.count + excluded.count'
  FROM cella.personal_columns(slots.schema, slots.tab) p
  HAVING count(*) > 0;
END;

-- Each state table's hash of the schemas named, from scratch: every row's
-- terms read, the commitments joined once by subject. The owner's.
CREATE FUNCTION cella.table_hashes(schemas text[]) RETURNS TABLE (tab text, hash bytea)
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM cella.state_tables(schemas) LOOP
    tab := t.schema || '.' || t.tab;
    EXECUTE format('SELECT coalesce(cella.lthash_sum(cella.lthash(q.e)), cella.lthash_zero()) FROM (%s) q',
                   cella.terms(t.schema, t.tab, format('ONLY %I.%I', t.schema, t.tab), true)) INTO hash;
    RETURN NEXT;
  END LOOP;
END
$$;

-- A state hash: the BLAKE3 of each table's name, a tab and its hash in
-- hex, a line each, by name.
CREATE FUNCTION cella.state_of(hashes jsonb) RETURNS bytea
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT cella.digest(coalesce(string_agg(h.key || E'\t' || (h.value #>> '{}'), E'\n' ORDER BY h.key COLLATE "C"), ''))
  FROM jsonb_each(state_of.hashes) h;
END;

-- The state hash of the schemas' tables from scratch, or of the folded
-- slices' unnamed, as `cella fold --compare` reads both databases.
CREATE FUNCTION cella.state_hash(schemas text[]) RETURNS bytea
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT cella.state_of(coalesce(jsonb_object_agg(t.tab, encode(t.hash, 'hex')), '{}'))
  FROM cella.table_hashes(state_hash.schemas) t;
END;
CREATE FUNCTION cella.state_hash() RETURNS bytea
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT cella.state_hash(ARRAY(SELECT f.schema FROM cella.folded() f WHERE f.folded));
END;

-- The state hash of the schemas' tables as the fold keeps them, reading
-- no row: a table it keeps no hash for is refused, naming it.
CREATE FUNCTION cella.kept_hash(schemas text[]) RETURNS bytea
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  missing text;
  hashes jsonb;
BEGIN
  SELECT jsonb_object_agg(t.schema || '.' || t.tab, encode(h.hash, 'hex')) INTO hashes
    FROM cella.state_tables(schemas) t JOIN cella.table_hash h ON h.tab = t.schema || '.' || t.tab;
  SELECT string_agg(t.schema || '.' || t.tab, ', ') INTO missing
    FROM cella.state_tables(schemas) t WHERE NOT EXISTS (SELECT FROM cella.table_hash h WHERE h.tab = t.schema || '.' || t.tab);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'cella.kept_hash: no hash is kept of %, so this database was not folded with its hashes kept', missing;
  END IF;
  RETURN cella.state_of(coalesce(hashes, '{}'));
END
$$;
CREATE FUNCTION cella.kept_hash() RETURNS bytea
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT cella.kept_hash(ARRAY(SELECT f.schema FROM cella.folded() f WHERE f.folded));
END;

-- The terms a fold's session wrote since its kept hashes last moved, each
-- table's, `k` times each, or a sum `d` of them: a row's trigger appends
-- to it, which costs no rewrite of a hash, and `cella.kept_flush` adds
-- them to the kept hashes at the end of each `cella.fold_log`, before a
-- checkpoint reads them. A temporary table, made by the session that
-- folds (`cella.kept_session`).
CREATE FUNCTION cella.kept_session() RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF to_regclass('pg_temp.cella_kept_delta') IS NULL THEN
    CREATE TEMPORARY TABLE cella_kept_delta (tab text NOT NULL, e text, k bigint NOT NULL, d bytea);
  END IF;
END
$$;

CREATE FUNCTION cella.kept_flush() RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  UPDATE cella.table_hash h SET hash = cella.lthash_add(h.hash, s.d)
  FROM (SELECT g.tab, cella.lthash_sum(g.d) AS d
        FROM (SELECT x.tab, cella.lthash_times(cella.lthash_sum(coalesce(x.d, cella.lthash(x.e))), x.k) AS d
              FROM pg_temp.cella_kept_delta x GROUP BY x.tab, x.k) g
        GROUP BY g.tab) s
  WHERE h.tab = s.tab;
  DELETE FROM pg_temp.cella_kept_delta;
END
$$;

-- Changes a table's kept hash by a row it added, took or changed, and the
-- counts of its subjects' rows: a row's trigger, since a statement's
-- fires on no partition a row is written to through its parent, made for
-- each table by `cella.keep_hashes` with its SQL written in, so its plans
-- are kept. Only while a fold writes, `cella.folding` on, so a row written
-- around the fold leaves the kept hash as it was, and the compare finds
-- it. Its body: the terms of the row added and of the row taken, each
-- kept in the session (`cella.kept_flush`), and the changes of their
-- counts.
CREATE FUNCTION cella.keeper(schema text, tab text) RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT format($b$
BEGIN
  IF current_setting('cella.folding', true) IS DISTINCT FROM 'on' THEN
    RETURN NULL;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    INSERT INTO pg_temp.cella_kept_delta (tab, e, k) SELECT %5$L, q.e, 1 FROM (%1$s) q;
    %2$s
  END IF;
  IF TG_OP <> 'INSERT' THEN
    INSERT INTO pg_temp.cella_kept_delta (tab, e, k) SELECT %5$L, q.e, -1 FROM (%3$s) q;
    %4$s
  END IF;
  RETURN NULL;
END
$b$,
    cella.terms(keeper.schema, keeper.tab, '(SELECT (NEW).*)', false),
    coalesce(cella.slots(keeper.schema, keeper.tab, '(SELECT (NEW).*)', '1') || ';', ''),
    cella.terms(keeper.schema, keeper.tab, '(SELECT (OLD).*)', false),
    coalesce(cella.slots(keeper.schema, keeper.tab, '(SELECT (OLD).*)', '-1') || ';', ''),
    keeper.schema || '.' || keeper.tab);
END;

-- A field's subject whose commitment a statement changed, from `was`: its
-- table's hash moves each row's second term to the new commitment, by the
-- count of the subject's rows, or to or from its rows' values where none
-- holds before or after, which reads the subject's rows alone.
CREATE FUNCTION cella.rekeep(field text, subject text, was text) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  now text := cella.committed(field, subject, NULL);
  k bigint;
  f record;
  raw bytea;
BEGIN
  IF was IS NOT DISTINCT FROM now THEN
    RETURN;
  END IF;
  k := coalesce((SELECT s.count FROM cella.slot s WHERE s.field = rekeep.field AND s.subject = rekeep.subject), 0);
  SELECT * INTO f FROM cella.kept_field x WHERE x.field = rekeep.field;
  IF k = 0 OR NOT FOUND THEN
    RETURN;
  END IF;
  IF was IS NULL OR now IS NULL THEN
    EXECUTE f.raw INTO raw USING subject;
  END IF;
  INSERT INTO pg_temp.cella_kept_delta (tab, e, k, d)
  SELECT f.tab, x.e, x.k, x.d FROM (VALUES
    (CASE WHEN was IS NOT NULL THEN jsonb_build_array(field, subject, was)::text END, CASE WHEN was IS NULL THEN -1 ELSE -k END, CASE WHEN was IS NULL THEN raw END),
    (CASE WHEN now IS NOT NULL THEN jsonb_build_array(field, subject, now)::text END, CASE WHEN now IS NULL THEN 1 ELSE k END, CASE WHEN now IS NULL THEN raw END)) x(e, k, d)
  WHERE x.e IS NOT NULL OR x.d IS NOT NULL;
END
$$;

-- The commitments a statement added to or took from those the fold
-- applied: each field and subject it touched, from the commitment that
-- held before it.
CREATE FUNCTION cella.keep_commitments() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  c record;
BEGIN
  IF current_setting('cella.folding', true) IS DISTINCT FROM 'on' THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    FOR c IN SELECT DISTINCT x.field, x.subject FROM cella_new x LOOP
      PERFORM cella.rekeep(c.field, c.subject, coalesce(
        (SELECT encode(s.commitment, 'hex') FROM vault.secret s WHERE s.field = c.field AND s.subject = c.subject
         ORDER BY s.receipt DESC, s.commitment DESC LIMIT 1),
        (SELECT encode(m.commitment, 'hex') FROM cella.commitment m
         WHERE m.field = c.field AND m.subject = c.subject
           AND NOT EXISTS (SELECT FROM cella_new y WHERE (y.field, y.subject, y.n, y.commitment) = (m.field, m.subject, m.n, m.commitment))
         ORDER BY m.n DESC, m.commitment DESC LIMIT 1)));
    END LOOP;
  ELSE
    FOR c IN SELECT DISTINCT x.field, x.subject FROM cella_old x LOOP
      PERFORM cella.rekeep(c.field, c.subject, coalesce(
        (SELECT encode(s.commitment, 'hex') FROM vault.secret s WHERE s.field = c.field AND s.subject = c.subject
         ORDER BY s.receipt DESC, s.commitment DESC LIMIT 1),
        (SELECT encode(m.commitment, 'hex') FROM (
           SELECT y.n, y.commitment FROM cella.commitment y WHERE y.field = c.field AND y.subject = c.subject
           UNION ALL SELECT y.n, y.commitment FROM cella_old y WHERE y.field = c.field AND y.subject = c.subject) m
         ORDER BY m.n DESC, m.commitment DESC LIMIT 1)));
    END LOOP;
  END IF;
  RETURN NULL;
END
$$;
CREATE TRIGGER keep_added AFTER INSERT ON cella.commitment
  REFERENCING NEW TABLE AS cella_new FOR EACH STATEMENT EXECUTE FUNCTION cella.keep_commitments();
CREATE TRIGGER keep_taken AFTER DELETE ON cella.commitment
  REFERENCING OLD TABLE AS cella_old FOR EACH STATEMENT EXECUTE FUNCTION cella.keep_commitments();

-- Keeps the hash of every registered state table in this database as the
-- fold writes: each table's trigger and the function it runs, and the hash, from
-- scratch, of a table it kept none for, reading only the schemas that
-- hold one. Run by `cella fold` before it folds, again on a resume, which
-- keeps every hash it holds and so reads no row. A superuser's, as the
-- fold is.
CREATE FUNCTION cella.keep_hashes() RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  t record;
  p record;
  rel text;
  fn text;
BEGIN
  FOR t IN SELECT * FROM cella.state_tables(ARRAY(SELECT DISTINCT s.schema FROM cella.state s)) LOOP
    rel := format('%I.%I', t.schema, t.tab);
    fn := format('cella.%I', 'keep ' || t.schema || '.' || t.tab);
    EXECUTE format('CREATE OR REPLACE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS %L',
                   fn, cella.keeper(t.schema, t.tab));
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s() FROM PUBLIC', fn);
    FOR p IN SELECT * FROM cella.personal_columns(t.schema, t.tab) LOOP
      INSERT INTO cella.kept_field (field, tab, raw)
      VALUES (p.field, t.schema || '.' || t.tab, format(
        'SELECT cella.lthash_sum(cella.lthash(jsonb_build_array(%L::text, y.c, y.r)::text)) FROM (SELECT %s AS c, x.%I::text AS r FROM ONLY %s x WHERE x.%I::text = $1 AND %s) y',
        p.field, cella.canon(t.schema, t.tab), p.col, rel, p.subject, p.active))
      ON CONFLICT (field) DO UPDATE SET tab = excluded.tab, raw = excluded.raw;
    END LOOP;
    EXECUTE format('CREATE OR REPLACE TRIGGER cella_keep AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION %s()', rel, fn);
  END LOOP;
  INSERT INTO cella.table_hash (tab, hash)
  SELECT h.tab, h.hash FROM cella.table_hashes(ARRAY(
    SELECT DISTINCT u.schema FROM cella.state_tables(ARRAY(SELECT DISTINCT s.schema FROM cella.state s)) u
    WHERE NOT EXISTS (SELECT FROM cella.table_hash k WHERE k.tab = u.schema || '.' || u.tab))) h
  WHERE NOT EXISTS (SELECT FROM cella.table_hash k WHERE k.tab = h.tab);
END
$$;

-- Every kept hash and count from scratch, as the state stands: where a
-- fold begins, and once the founding's carried rows are in, which no
-- trigger saw.
CREATE FUNCTION cella.rehash() RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  t record;
  s text;
BEGIN
  PERFORM cella.kept_session();
  DELETE FROM pg_temp.cella_kept_delta;
  DELETE FROM cella.table_hash;
  DELETE FROM cella.slot;
  INSERT INTO cella.table_hash (tab, hash)
  SELECT h.tab, h.hash FROM cella.table_hashes(ARRAY(SELECT DISTINCT x.schema FROM cella.state x)) h;
  FOR t IN SELECT * FROM cella.state_tables(ARRAY(SELECT DISTINCT x.schema FROM cella.state x)) LOOP
    s := cella.slots(t.schema, t.tab, format('ONLY %I.%I', t.schema, t.tab), '1');
    IF s IS NOT NULL THEN
      EXECUTE s;
    END IF;
  END LOOP;
END
$$;

REVOKE EXECUTE ON FUNCTION cella.state_tables(text[]), cella.terms(text, text, text, boolean),
  cella.personal_columns(text, text), cella.canon(text, text), cella.keeper(text, text), cella.slots(text, text, text, text), cella.table_hashes(text[]),
  cella.state_hash(text[]), cella.state_hash(), cella.kept_hash(text[]), cella.kept_hash(), cella.kept_session(), cella.kept_flush(),
  cella.rekeep(text, text, text), cella.keep_commitments(), cella.keep_hashes(), cella.rehash() FROM PUBLIC;
