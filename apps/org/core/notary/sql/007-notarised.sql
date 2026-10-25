-- The notary at 0.4.0: a write's state lands only inside a transaction
-- `cella.begin` opened and `cella.submit` settled. A database made before
-- it is upgraded in place. Only the app opens a write, as only it submits.
ALTER EXTENSION cella UPDATE;

REVOKE EXECUTE ON FUNCTION cella.begin(text, text, bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cella.begin(text, text, bytea) TO cella_app;

-- Every table a feat or a graft makes is state: registered as it is made,
-- so the notary's trigger refuses any row no write changes. The notary's
-- own schemas, the migrations' record, the catalog and temporary tables
-- are not; nor is anything in `public`, which no slice owns.
CREATE FUNCTION cella.registered() RETURNS event_trigger LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  made record;
BEGIN
  FOR made IN
    SELECT objid FROM pg_event_trigger_ddl_commands()
    WHERE object_type = 'table' AND NOT in_extension
      AND schema_name NOT IN ('cella', 'vault', 'migration', 'public', 'information_schema')
      AND schema_name NOT LIKE 'pg\_%'
  LOOP
    PERFORM cella.notarise(made.objid::regclass);
  END LOOP;
END
$$;
REVOKE EXECUTE ON FUNCTION cella.registered() FROM PUBLIC;

CREATE EVENT TRIGGER registered ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION cella.registered();

-- The tables made before it, on a database it upgrades.
SELECT cella.notarise(c.oid::regclass)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('cella', 'vault', 'migration', 'public', 'information_schema')
  AND n.nspname NOT LIKE 'pg\_%'
  AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
ORDER BY n.nspname, c.relname;
