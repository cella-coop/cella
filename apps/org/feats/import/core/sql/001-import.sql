CREATE SCHEMA import;

CREATE SEQUENCE import.number;

-- A file imported from another tool, or tried in a dry run: its kind, the
-- name it was uploaded under, who imported it and on what day, how many
-- of its lines settled and how many did not, and each line: where it was
-- read, what it is, the write it made, how that came out, its log entry
-- or the reason it was refused. What each line is names a record by its
-- id, address or title, never a person's name. A run never changes.
CREATE TABLE import.run (
  id text PRIMARY KEY DEFAULT 'im-' || lpad(nextval('import.number')::text, 4, '0'),
  kind text NOT NULL CHECK (kind ~ '^[a-z]+$'),
  name text NOT NULL CHECK (name <> ''),
  actor text NOT NULL,
  day date NOT NULL,
  dry boolean NOT NULL,
  settled integer NOT NULL CHECK (settled >= 0),
  refused integer NOT NULL CHECK (refused >= 0),
  lines jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array'),
  CHECK (settled + refused = jsonb_array_length(lines))
);

COMMENT ON COLUMN import.run.name IS 'not personal: the name the imported file was uploaded under, such as members.csv';

-- import:run:record — the write recorded the run it names, as the actor
-- on the verdict date, with the counts it names.
CREATE FUNCTION import.records(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.id IS NULL THEN 'no run ' || coalesce(x.run, 'is named')
    WHEN r.actor IS DISTINCT FROM cella.actor() OR r.day IS DISTINCT FROM cella.verdict_date() THEN r.id || ' was not recorded by this write'
    WHEN (r.kind, r.dry, r.settled, r.refused) IS DISTINCT FROM (x.kind, x.dry, x.settled, x.refused) THEN r.id || ' is not the run the write names'
  END
  FROM (
    SELECT payload ->> 'run' AS run, payload ->> 'kind' AS kind, (payload ->> 'dry')::boolean AS dry,
           (payload ->> 'settled')::integer AS settled, (payload ->> 'refused')::integer AS refused
  ) x
  LEFT JOIN import.run r ON r.id = x.run;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('import:run:record', 'import.records(jsonb)', 'import');

GRANT USAGE ON SCHEMA import TO cella_app, cella_rules;
GRANT SELECT ON import.run TO cella_app, cella_rules;
GRANT INSERT ON import.run TO cella_app;
GRANT USAGE ON SEQUENCE import.number TO cella_app;
