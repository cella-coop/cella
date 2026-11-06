-- Reading follows the mandates: a person reads a record only by a mandate
-- whose scope covers its owning circle. `read` is the read group's power,
-- which no action needs: a mandate for it reads every record its scope
-- covers. A power a feat names as reading its rows in `cella.reading`
-- reads them too, by its scope (`cella.circles`).

-- The owning circles whose records of the feats `what` the reader reads
-- in: those their mandates for `read` cover, and those a power the feats
-- name covers. It does not depend on the row, so a policy asks it once
-- per query, as `circle = ANY ((SELECT circle.reads(what))::text[])`.
CREATE FUNCTION circle.reads(what text[]) RETURNS text[]
LANGUAGE sql STABLE
RETURN ARRAY(
  SELECT DISTINCT c
  FROM (
    SELECT unnest(cella.covered('read'))
    UNION ALL
    SELECT unnest(cella.circles(w)) FROM unnest(reads.what) w
  ) x(c)
  ORDER BY c
);

-- Whether the session reads the whole: a write's transaction, or a
-- session whose role, the one it set or else its login, is a superuser or
-- bypasses row-level security. It asks the session's role, never the
-- current user, so a SECURITY DEFINER function asks it of its caller,
-- where `cella.sees`, asking the current user, answers for the
-- function's owner; and a server that logs in as the owner and sets the
-- role `cella_app` reads as the app. A definer function that filters
-- its rows by its reader's test reads it in place of `cella.sees`, as
-- `(SELECT circle.whole())`.
CREATE FUNCTION circle.whole() RETURNS boolean
LANGUAGE sql STABLE
RETURN cella.writing()
  OR (SELECT r.rolsuper OR r.rolbypassrls FROM pg_catalog.pg_roles r
      WHERE r.rolname = coalesce(nullif(current_setting('role'), 'none'), session_user));

-- The schemas of core and the notary, whose tables no slice makes.
CREATE FUNCTION circle.cored(schema text) RETURNS boolean
LANGUAGE sql IMMUTABLE
RETURN schema IN ('cella', 'vault', 'migration', 'public', 'information_schema', 'circle', 'policy', 'analytics')
  OR schema LIKE 'pg\_%';

-- Every table a feat or a graft makes is under row-level security as it
-- is made, enabled and forced, so its owner too is under its policies
-- unless it is a superuser, whom Postgres exempts from every one. A table
-- that names its owning circle takes the policy `circle`, which lets a
-- reader see a row of a circle they read in, the feats whose table it is
-- read from its schema's name, a graft's each feat it joins; a write's
-- transaction sees the whole (`cella.sees`), and the guards role reads
-- the whole. A table a person's data is in drops `circle` for a policy of
-- its own, which `read` opens nothing of. A table that names none is a
-- registry, the same in every scope (`feat-check` refuses any other), and
-- takes the policy `registry`, which every reader reads.
CREATE FUNCTION circle.scoped() RETURNS event_trigger LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  made record;
BEGIN
  FOR made IN
    SELECT DISTINCT d.objid::regclass AS t, d.schema_name AS s
    FROM pg_event_trigger_ddl_commands() d
    WHERE d.object_type = 'table' AND NOT d.in_extension
      AND NOT circle.cored(d.schema_name)
      AND NOT EXISTS (SELECT FROM pg_policy p WHERE p.polrelid = d.objid AND p.polname IN ('circle', 'registry'))
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY', made.t);
    IF EXISTS (
      SELECT FROM pg_attribute a
      WHERE a.attrelid = made.t AND a.attname = 'circle' AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
      EXECUTE format(
        'CREATE POLICY circle ON %s TO cella_app USING ((SELECT cella.sees(%L)) OR circle = ANY ((SELECT circle.reads(%L))::text[])) WITH CHECK (true)',
        made.t, made.s, string_to_array(made.s, '_')
      );
      EXECUTE format('CREATE POLICY circle_guards ON %s FOR SELECT TO cella_guards USING (true)', made.t);
    ELSE
      EXECUTE format('CREATE POLICY registry ON %s TO cella_app USING (true) WITH CHECK (true)', made.t);
      EXECUTE format('CREATE POLICY registry_guards ON %s FOR SELECT TO cella_guards USING (true)', made.t);
    END IF;
  END LOOP;
END
$$;
REVOKE EXECUTE ON FUNCTION circle.scoped() FROM PUBLIC;

CREATE EVENT TRIGGER scoped ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION circle.scoped();

-- The tables of the feats and the grafts, and of core's structure, that
-- escape the reading rule:
-- each not under row-level security, enabled and forced, or with no
-- policy by which the app role reads it. `cella migrate` fails a run that
-- leaves any.
CREATE FUNCTION circle.unsecured() RETURNS SETOF text
LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT c.oid::regclass::text || CASE
      WHEN NOT c.relrowsecurity THEN ' is not under row-level security'
      WHEN NOT c.relforcerowsecurity THEN ' does not force row-level security'
      ELSE ' has no policy the app role reads by'
    END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p') AND (NOT circle.cored(n.nspname) OR n.nspname IN ('circle', 'policy'))
    AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR NOT EXISTS (
      SELECT FROM pg_policy p
      WHERE p.polrelid = c.oid AND p.polpermissive AND p.polcmd IN ('r', '*')
        AND (p.polroles = '{0}' OR (SELECT oid FROM pg_roles WHERE rolname = 'cella_app') = ANY (p.polroles))
    ))
  ORDER BY 1;
END;
