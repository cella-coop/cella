-- Who holds a right on a day. A right is a mandate people hold as such,
-- with no seat: every person, every member, every employee. Which people
-- each right names is said by the kind of person it is about, a feat
-- nested in this one, by the function it registers here: membership the
-- active members, employment those employed. This core knows none of
-- them by name, and holds the one every kind nests in, the person.
CREATE TABLE person.rights (
  name text PRIMARY KEY CHECK (name ~ '^[a-z]+$'),
  fn regprocedure NOT NULL,
  owner text NOT NULL
);

-- Registers who holds a right: `fn`, `(address, day) → boolean`, says
-- whether an address is one of its people on a day. A nested feat's
-- migration calls it, and never inserts the row itself.
CREATE FUNCTION person.register_right(name text, fn regprocedure, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO person.rights (name, fn, owner) VALUES (register_right.name, register_right.fn, register_right.owner);
END;

REVOKE EXECUTE ON FUNCTION person.register_right(text, regprocedure, text) FROM PUBLIC;

-- Whether an address is a person the co-op knows: everyone who signs is,
-- for good, so every person's right is held on any day.
CREATE FUNCTION person.known(address text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (SELECT FROM person.person p WHERE p.address = known.address);
END;

SELECT person.register_right('person', 'person.known(text, date)', 'person');

-- Whether an actor holds a right on a day: they are a person, and one of
-- the people the right names, as its registered function says. No one
-- holds a right nobody registered, and only people hold any.
CREATE FUNCTION person.holds(actor text, "right" text, day date) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  f regprocedure;
  ok boolean;
BEGIN
  SELECT r.fn INTO f FROM person.rights r WHERE r.name = holds."right";
  IF f IS NULL OR actor IS NULL OR NOT person.known(actor, day) THEN
    RETURN false;
  END IF;
  EXECUTE format('SELECT %s($1, $2)', f::oid::regproc) INTO ok USING actor, day;
  RETURN coalesce(ok, false);
END
$$;

COMMENT ON COLUMN person.rights.name IS 'not personal: the name of a right, such as member';

GRANT SELECT ON person.rights TO cella_app, cella_guards;

COMMENT ON TABLE person.rights IS 'registry: who holds each right, as the nested feats register it';
