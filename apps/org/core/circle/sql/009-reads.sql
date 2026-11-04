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

-- Every table a feat or a graft makes that names its owning circle is
-- under row-level security for the app role as it is made: the policy
-- `circle` lets a reader see a row of a circle they read in, the feats
-- whose table it is read from its schema's name, a graft's each feat it
-- joins; a write's transaction sees the whole (`cella.sees`), and the
-- guards role reads the whole. A table a person's data is in drops
-- `circle` for a policy of its own, which `read` opens nothing of.
CREATE FUNCTION circle.scoped() RETURNS event_trigger LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  made record;
BEGIN
  FOR made IN
    SELECT DISTINCT d.objid::regclass AS t, d.schema_name AS s
    FROM pg_event_trigger_ddl_commands() d
    WHERE d.object_type = 'table' AND NOT d.in_extension
      AND d.schema_name NOT IN ('cella', 'vault', 'migration', 'public', 'information_schema', 'circle', 'policy', 'analytics')
      AND d.schema_name NOT LIKE 'pg\_%'
      AND EXISTS (
        SELECT FROM pg_attribute a
        WHERE a.attrelid = d.objid AND a.attname = 'circle' AND a.attnum > 0 AND NOT a.attisdropped
      )
      AND NOT EXISTS (SELECT FROM pg_policy p WHERE p.polrelid = d.objid AND p.polname = 'circle')
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', made.t);
    EXECUTE format(
      'CREATE POLICY circle ON %s TO cella_app USING ((SELECT cella.sees(%L)) OR circle = ANY ((SELECT circle.reads(%L))::text[])) WITH CHECK (true)',
      made.t, made.s, string_to_array(made.s, '_')
    );
    EXECUTE format('CREATE POLICY circle_guards ON %s FOR SELECT TO cella_guards USING (true)', made.t);
  END LOOP;
END
$$;
REVOKE EXECUTE ON FUNCTION circle.scoped() FROM PUBLIC;

CREATE EVENT TRIGGER scoped ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION circle.scoped();
