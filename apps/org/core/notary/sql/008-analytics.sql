-- The role the analytics shell reads as. It is granted nothing here:
-- `cella migrate` grants it SELECT on each view a slice publishes in its
-- `sql/analytics.sql`, and USAGE on that slice's schema, and nothing
-- else. Every transaction it opens is read-only, it owns nothing, and it
-- runs past no row-level security: each view reads as its owner, so what
-- a view shows is what its slice agreed to share.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cella_analytics') THEN
    CREATE ROLE cella_analytics LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

ALTER ROLE cella_analytics SET default_transaction_read_only = on;
