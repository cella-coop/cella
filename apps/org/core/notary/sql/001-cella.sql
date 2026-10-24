-- The cella extension and the role the app connects as. The app role reads
-- the log and calls the extension's functions; it never writes cella.*.
CREATE EXTENSION IF NOT EXISTS cella;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cella_app') THEN
    CREATE ROLE cella_app LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA cella TO cella_app;
