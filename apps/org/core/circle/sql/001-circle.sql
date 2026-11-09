CREATE SCHEMA circle;

-- What a mandate is granted to: a circle or a role, one row for each, by
-- its id, so circles and roles share one key and a mandate's recipient
-- is one foreign key. Never a person: a person holds a role by a seat.
-- Its rows are made by the triggers below as each circle and role is.
CREATE TABLE circle.grantee (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('circle', 'role'))
);

-- A circle of the co-op: its members, the membership feat's, and
-- its decision rule, the procedure its motions are decided by where
-- nothing they act under asks another. Circles never nest: no circle has
-- a parent, and `assembly` marks the general assembly, one circle only,
-- which holds every power inherently.
CREATE TABLE circle.circle (
  id text PRIMARY KEY,
  name text NOT NULL,
  assembly boolean NOT NULL DEFAULT false,
  purpose text NOT NULL DEFAULT '',
  procedure text NOT NULL DEFAULT 'consent' CHECK (procedure IN ('consent', 'majority'))
);

CREATE UNIQUE INDEX one_assembly ON circle.circle ((true)) WHERE assembly;

-- A named duty that mandates attach to: in one circle, or in every working
-- circle (`*`). `holders` caps how many hold it at once in a circle, by
-- their tenures; none, uncapped.
CREATE TABLE circle.role (
  id text PRIMARY KEY,
  circle text NOT NULL,
  name text NOT NULL,
  duty text NOT NULL DEFAULT '',
  holders int CHECK (holders > 0)
);

-- Each circle and each role is a grantee, made with it: an id the other
-- kind holds already is refused.
CREATE FUNCTION circle.granted_to() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM circle.grantee g WHERE g.id = NEW.id AND g.kind <> TG_ARGV[0]) THEN
    RAISE EXCEPTION '% is a % already: a circle and a role never share an id', NEW.id, (SELECT g.kind FROM circle.grantee g WHERE g.id = NEW.id)
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  INSERT INTO circle.grantee (id, kind) VALUES (NEW.id, TG_ARGV[0]) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END
$$;

CREATE TRIGGER granted_to BEFORE INSERT ON circle.circle
  FOR EACH ROW EXECUTE FUNCTION circle.granted_to('circle');
CREATE TRIGGER granted_to BEFORE INSERT ON circle.role
  FOR EACH ROW EXECUTE FUNCTION circle.granted_to('role');

ALTER TABLE circle.circle ADD FOREIGN KEY (id) REFERENCES circle.grantee;
ALTER TABLE circle.role ADD FOREIGN KEY (id) REFERENCES circle.grantee;

-- A grant of one power to one grantee, a role, an individual mandate, or
-- a circle as a whole, a collective mandate its motions use, for a term:
-- the values of the mandate policy that grants it, copied as it is
-- adopted (`circle.issue`). `limit` caps a single write, `budget`
-- a total over `per`; never both. `from` and `until` are the days its
-- policy applies; `revoked`, the day its policy ended, from which it
-- grants nothing. `issuer` is the circle whose motion adopted it, and
-- `parent` the mandate it is issued under, one its issuer holds; none for
-- a mandate the assembly issues, a root of the provenance tree.
-- `procedure` names the procedure the motions acting under it are
-- decided by, which passes down its chain; the motion feat holds
-- procedures, so this feat keeps its name alone. `scope` is the
-- condition on what it covers: a circle's id, or `own`, the circle its
-- holder holds the role in; none, the whole co-op.
CREATE TABLE circle.mandate (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grantee text NOT NULL REFERENCES circle.grantee,
  issuer text NOT NULL REFERENCES circle.grantee,
  parent bigint REFERENCES circle.mandate,
  power text NOT NULL CHECK (power ~ '^[a-z][a-z-]*$'),
  policy text NOT NULL UNIQUE,
  "limit" cella.amount,
  budget cella.amount,
  per text CHECK (per IN ('month', 'year')),
  procedure text CHECK (procedure ~ '^[a-z][a-z-]*$'),
  scope text,
  "from" date NOT NULL,
  until date,
  revoked date,
  CHECK ("limit" IS NULL OR budget IS NULL),
  CHECK ((budget IS NULL) = (per IS NULL)),
  CHECK (until IS NULL OR "from" < until)
);

CREATE INDEX ON circle.mandate (grantee);
CREATE INDEX ON circle.mandate (power);
CREATE INDEX ON circle.mandate (parent);

-- A power the legal form gives every person, member or employee as such,
-- no mandate: it has no grantee, no issuer and no chain. The values of
-- the right policy that gives it, copied as it is adopted, on its
-- policy's days; `limit` caps a single write.
CREATE TABLE circle.right (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "right" text NOT NULL CHECK ("right" IN ('person', 'member', 'employee')),
  power text NOT NULL CHECK (power ~ '^[a-z][a-z-]*$'),
  policy text NOT NULL UNIQUE,
  "limit" cella.amount,
  "from" date NOT NULL,
  until date,
  revoked date,
  CHECK (until IS NULL OR "from" < until)
);

CREATE INDEX ON circle.right (power);

-- Open books' disclosure values: what of a shared total of members' own
-- figures every member reads, copied from the assembly's rule that marks
-- them as it is adopted (`circle.disclose`), on its policy's days.
-- `contributors` is the fewest people a cell may count, `largest` the
-- most of it one may put in and `two` the most two may, in percent;
-- `revoked`, the day its rule ended or was replaced.
CREATE TABLE circle.disclosure (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  policy text NOT NULL UNIQUE,
  contributors integer NOT NULL CHECK (contributors BETWEEN 2 AND 200),
  largest numeric NOT NULL CHECK (largest BETWEEN 20 AND 100),
  two numeric NOT NULL CHECK (two BETWEEN 40 AND 100),
  "from" date NOT NULL,
  until date,
  revoked date,
  CHECK (largest <= two),
  CHECK (until IS NULL OR "from" < until)
);

-- What of the structure the co-op publishes to every person signed in,
-- member or not: the parts its assembly's publication rule names,
-- copied as it is adopted (`circle.publish`), on its policy's
-- days; `revoked`, the day its rule ended or was replaced.
CREATE TABLE circle.publication (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  policy text NOT NULL UNIQUE,
  parts text[] NOT NULL CHECK (cardinality(parts) > 0 AND parts <@ ARRAY['circles', 'roles', 'mandates', 'seats', 'register']),
  "from" date NOT NULL,
  until date,
  revoked date,
  CHECK (until IS NULL OR "from" < until)
);

-- The co-op's particulars: what it is called and the mentions its papers
-- print, copied from the assembly's rule that marks them as it is
-- adopted (`circle.particularise`), on its policy's days, each a text as
-- written, a value it marks not being null; `revoked`, the day its rule
-- ended or was replaced.
CREATE TABLE circle.particulars (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  policy text NOT NULL UNIQUE,
  name text NOT NULL CHECK (name ~ '\S'),
  legal_name text,
  form text,
  capital text,
  siren text,
  rcs text,
  vat text,
  seat text,
  "from" date NOT NULL,
  until date,
  revoked date,
  CHECK (until IS NULL OR "from" < until)
);

-- The settings slices offer: each a value a co-op or a circle sets for
-- itself, never one person, a switch, `on` or `off`, with its default and
-- the slice that registered it (`circle.register_setting`), from its
-- migration alone.
CREATE TABLE circle.setting (
  name text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9_]*$'),
  "default" text NOT NULL CHECK ("default" IN ('on', 'off')),
  owner text NOT NULL CHECK (owner ~ '^[a-z][a-z-]*$')
);

COMMENT ON TABLE circle.setting IS 'registry: the settings the slices register from their migrations, the same in every scope';

-- A circle's value of a setting, copied from the rule that marks it as
-- it is adopted (`circle.set_setting`), on its policy's days; `revoked`, the day
-- its rule ended or was replaced.
CREATE TABLE circle.setting_value (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  policy text NOT NULL UNIQUE,
  circle text NOT NULL REFERENCES circle.circle,
  setting text NOT NULL REFERENCES circle.setting,
  value text NOT NULL CHECK (value IN ('on', 'off')),
  "from" date NOT NULL,
  until date,
  revoked date,
  CHECK (until IS NULL OR "from" < until)
);

CREATE INDEX ON circle.setting_value (circle, setting);

GRANT USAGE ON SCHEMA circle TO cella_app, cella_guards;
GRANT SELECT ON ALL TABLES IN SCHEMA circle TO cella_app, cella_guards;

-- The general assembly's id: the one circle marked so, or null before
-- the co-op is founded. It runs as its owner, so whoever applies to it
-- learns its id, and nothing more of the structure.
CREATE FUNCTION circle.assembly() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT c.id FROM circle.circle c WHERE c.assembly;
END;

-- Every circle's participant role, built in, which every seat in a
-- circle holds there: its mandates cover proposing and discussing, as
-- `propose` and `discuss`. Its `circle` is `*`, so it is the assembly's
-- to grant; a seat in one circle brings it in no other.
INSERT INTO circle.role (id, circle, name, duty) VALUES
  ('participant', '*', 'Participant', 'every seat in the circle: proposing and discussing its motions, its channel and its agendas');
