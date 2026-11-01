-- The role every guard runs as. `submit` switches to it around each guard:
-- it reads what each feat and graft grants it, writes nothing, owns
-- nothing, and cannot log in.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cella_guards') THEN
    CREATE ROLE cella_guards NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA cella TO cella_guards;

-- Only the app appends: a guard that calls submit or takes a receipt would
-- write through the extension's own rights.
REVOKE EXECUTE ON FUNCTION cella.submit(text, jsonb, text, jsonb), cella.receipt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cella.submit(text, jsonb, text, jsonb), cella.receipt() TO cella_app;
