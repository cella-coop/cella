-- cella 0.3.0 to 0.4.0: a write's state lands only inside a transaction
-- that `cella.begin` opened and `cella.submit` settled. `submit` refuses a
-- write not begun, or begun as another; a begun transaction commits only
-- with its verdict; and `cella.notarise(tab)` registers a state table in
-- `cella.state` and installs the trigger that refuses a row no begun
-- transaction writes. `ALTER EXTENSION cella UPDATE` runs it, with the
-- 0.4.0 library loaded; the org core registers the tables it already has.

CREATE FUNCTION cella."begin"(
	"op" TEXT, /* & str */
	"actor" TEXT, /* & str */
	"device" bytea /* & [u8] */
) RETURNS void
STRICT VOLATILE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'begin_wrapper';

CREATE FUNCTION cella."notarised"()
	RETURNS TRIGGER
	LANGUAGE c
	AS 'MODULE_PATHNAME', 'notarised_wrapper';

CREATE TABLE cella.state (
    schema text NOT NULL,
    tab text NOT NULL,
    PRIMARY KEY (schema, tab)
);
CREATE FUNCTION cella.notarise(tab regclass) RETURNS boolean LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO cella.state (schema, tab)
  SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = notarise.tab
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  -- A partition takes its row trigger from its table, registered before
  -- or after it.
  IF NOT (SELECT c.relispartition FROM pg_class c WHERE c.oid = notarise.tab) THEN
    EXECUTE format('CREATE CONSTRAINT TRIGGER notarised AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION cella.notarised()', notarise.tab);
  END IF;
  EXECUTE format('CREATE TRIGGER notarised_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION cella.notarised()', notarise.tab);
  RETURN true;
END
$$;
REVOKE ALL ON cella.state FROM PUBLIC;
GRANT SELECT ON cella.state TO PUBLIC;
REVOKE EXECUTE ON FUNCTION cella.notarise(regclass) FROM PUBLIC;
SELECT pg_catalog.pg_extension_config_dump('cella.state', '');
