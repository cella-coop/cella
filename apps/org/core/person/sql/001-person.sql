CREATE SCHEMA person;

-- Someone the co-op knows, by the address they sign with, for good: their
-- name and how to reach them. Whether they are a member is membership's,
-- whether they work for the co-op employment's; a person holds neither
-- until one of them says so.
CREATE TABLE person.person (
  circle text NOT NULL,
  address text PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text
);

-- person:person:profile — a person edits their own profile, and no one
-- else's.
CREATE FUNCTION person.own_profile(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN x.address IS NULL THEN 'no one ' || coalesce(p.address, 'is named')
    WHEN x.address <> cella.actor() THEN cella.actor() || ' may not edit ' || x.address || '''s profile'
  END
  FROM (SELECT payload ->> 'person' AS address) p
  LEFT JOIN person.person x ON x.address = p.address;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('person:person:profile', 'person.own_profile(jsonb)', 'person');

GRANT USAGE ON SCHEMA person TO cella_app, cella_guards;
GRANT SELECT, INSERT ON person.person TO cella_app;
GRANT UPDATE (name, email, phone) ON person.person TO cella_app;
GRANT SELECT ON person.person TO cella_guards;
