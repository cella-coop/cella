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

-- A grant of one power to one role, for a term. `limit` caps a single
-- write, `budget` a total over `per`; never both. A mandate with no `from`
-- was granted before the records began.
CREATE TABLE circle.mandate (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role text NOT NULL REFERENCES circle.role,
  power text NOT NULL CHECK (power ~ '^[a-z][a-z-]*$'),
  text text NOT NULL,
  "limit" cella.amount,
  budget cella.amount,
  per text CHECK (per IN ('month', 'year')),
  "from" date,
  until date,
  revoked date,
  CHECK ("limit" IS NULL OR budget IS NULL),
  CHECK ((budget IS NULL) = (per IS NULL)),
  CHECK (until IS NULL OR "from" IS NULL OR "from" < until)
);

CREATE INDEX ON circle.mandate (role);
CREATE INDEX ON circle.mandate (power);

GRANT USAGE ON SCHEMA circle TO cella_app, cella_rules;
GRANT SELECT ON ALL TABLES IN SCHEMA circle TO cella_app, cella_rules;
