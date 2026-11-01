CREATE SCHEMA circle;

-- A circle of the co-op; the root, the assembly, has no parent.
CREATE TABLE circle.circle (
  id text PRIMARY KEY,
  name text NOT NULL,
  parent text REFERENCES circle.circle,
  purpose text NOT NULL DEFAULT '',
  procedure text NOT NULL DEFAULT 'consent' CHECK (procedure IN ('consent', 'majority'))
);

-- A named duty that mandates attach to: in one circle, or in every working
-- circle (`*`).
CREATE TABLE circle.role (
  id text PRIMARY KEY,
  circle text NOT NULL,
  name text NOT NULL,
  duty text NOT NULL DEFAULT ''
);

-- A grant of one power to one role, an individual mandate, to one
-- circle as a whole, a collective mandate its motions use, or to the
-- people who hold a right, every person, member or employee, for a term:
-- the values of the mandate policy that grants it, copied as it is
-- adopted (`circle.mandate_from`). `limit` caps a single write, `budget`
-- a total over `per`; never both. `from` and `until` are the days its
-- policy applies; `revoked`, the day its policy ended, from which it
-- grants nothing.
CREATE TABLE circle.mandate (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role text REFERENCES circle.role,
  circle text REFERENCES circle.circle,
  "right" text CHECK ("right" IN ('person', 'member', 'employee')),
  power text NOT NULL CHECK (power ~ '^[a-z][a-z-]*$'),
  policy text NOT NULL UNIQUE,
  "limit" cella.amount,
  budget cella.amount,
  per text CHECK (per IN ('month', 'year')),
  "from" date NOT NULL,
  until date,
  revoked date,
  CHECK (num_nonnulls(role, circle, "right") = 1),
  CHECK ("limit" IS NULL OR budget IS NULL),
  CHECK ((budget IS NULL) = (per IS NULL)),
  CHECK (until IS NULL OR "from" < until)
);

CREATE INDEX ON circle.mandate (role);
CREATE INDEX ON circle.mandate (circle);
CREATE INDEX ON circle.mandate (power);

GRANT USAGE ON SCHEMA circle TO cella_app, cella_guards;
GRANT SELECT ON ALL TABLES IN SCHEMA circle TO cella_app, cella_guards;

-- Every circle's participant role, built in, which every seat in a
-- circle holds there: its mandates cover proposing and discussing, as
-- `propose` and `discuss`. Its `circle` is `*`, so it is the assembly's
-- to grant; a seat above brings it in no circle below.
INSERT INTO circle.role (id, circle, name, duty) VALUES
  ('participant', '*', 'Participant', 'every seat in the circle: proposing and discussing its motions, its channel and its agendas');

-- circle:circle:message needs the participant's `discuss`, which
-- circle-membership holds to a seat in the message's circle.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('circle:circle:message', 'discuss', NULL, 'circle');
