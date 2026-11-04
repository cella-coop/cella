-- The checks every line of the journal passes, whichever write posts it,
-- as the feats and grafts extending the journal register them: each is a
-- function of the line, `(transaction.line) → void`, that raises SQLSTATE
-- 09000 to refuse it. This feat knows none of them by name, and no
-- extender puts a trigger on the journal.
CREATE TABLE transaction.line_check (
  fn regprocedure PRIMARY KEY,
  owner text NOT NULL
);

-- Registers a check of every line posted. An extender's migration calls
-- it, and never inserts the row itself.
CREATE FUNCTION transaction.register_line_check(fn regprocedure, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO transaction.line_check (fn, owner) VALUES (register_line_check.fn, register_line_check.owner);
END;

REVOKE EXECUTE ON FUNCTION transaction.register_line_check(regprocedure, text) FROM PUBLIC;

-- Runs every check registered, before each line is inserted, in the order
-- of their owners and names, so the order is the same in every scope.
CREATE FUNCTION transaction.checks() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN SELECT c.fn FROM transaction.line_check c ORDER BY c.owner, c.fn::text LOOP
    EXECUTE format('SELECT %s($1)', f::oid::regproc) USING NEW;
  END LOOP;
  RETURN NEW;
END
$$;

CREATE TRIGGER checks BEFORE INSERT ON transaction.line
  FOR EACH ROW EXECUTE FUNCTION transaction.checks();

GRANT SELECT ON transaction.line_check TO cella_app, cella_guards;

COMMENT ON TABLE transaction.line_check IS 'registry: the checks every journal line passes, as its extenders register them';
