CREATE SCHEMA report;

-- The saved reports: the four the feat draws itself, owned by no one, and
-- the members' own, each a port report as JSON with how it is charted, its
-- keys in the order they were written, which orders its columns,
-- saved by its owner on a day.
CREATE TABLE report.report (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]*$'),
  title text NOT NULL CHECK (title <> ''),
  caption text NOT NULL DEFAULT '',
  kind text NOT NULL CHECK (kind IN ('income', 'balance', 'margins', 'federation', 'custom')),
  definition json CHECK ((kind = 'custom') = (definition IS NOT NULL)),
  owner text CHECK ((kind = 'custom') = (owner IS NOT NULL)),
  saved date CHECK ((kind = 'custom') = (saved IS NOT NULL))
);

INSERT INTO report.report (id, title, caption, kind) VALUES
  ('income', 'Income statement', 'Income less expenses over a span, against the span before it, in the PCG''s rubrics', 'income'),
  ('balance', 'Balance sheet', 'What the co-op owns and owes at the end of a span, against the span before it', 'balance'),
  ('margins', 'Project margins', 'Each project''s margin, budget burn and forecasts, and the projects to watch', 'margins'),
  ('federation', 'Federation figures', 'A distributed year''s split, what it posted and the capital it credited', 'federation');

-- When a project is watched, from a day on: once its billable time has
-- spent `burn` percent of its budget, or once what it invoiced keeps less
-- than `margin` percent after its costs. A parameter, seeded with the
-- co-op's figures; a threshold per project is not built.
CREATE TABLE report.threshold (
  since date PRIMARY KEY,
  burn numeric NOT NULL CHECK (burn > 0),
  margin numeric NOT NULL CHECK (margin < 100)
);

-- report:report:save — why a saved report is not the one the write says,
-- or null: the actor's own custom report, saved on the verdict date, its
-- definition reading at least one view. A built-in report or another
-- member's is never saved over, so the row keeps its owner and is refused.
CREATE FUNCTION report.saves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.id IS NULL THEN 'no report ' || coalesce(x.id, 'is named')
    WHEN r.kind <> 'custom' THEN r.id || ' is a report the feat draws itself, saved by no one'
    WHEN r.owner IS DISTINCT FROM cella.actor() THEN r.id || ' is ' || r.owner || '''s report, not ' || coalesce(cella.actor(), 'no one') || '''s'
    WHEN r.saved IS DISTINCT FROM cella.verdict_date() THEN r.id || ' was not saved by this write'
    WHEN json_typeof(r.definition -> 'from') IS DISTINCT FROM 'object' OR (r.definition -> 'from')::jsonb = '{}'::jsonb
      THEN r.id || ' reads no view'
  END
  FROM (SELECT saves.payload ->> 'report' AS id) x
  LEFT JOIN report.report r ON r.id = x.id;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('report:report:save', 'report.saves(jsonb)', 'report');

GRANT USAGE ON SCHEMA report TO cella_app, cella_guards;
GRANT SELECT, INSERT, UPDATE ON report.report TO cella_app;
GRANT SELECT ON report.threshold TO cella_app;
GRANT SELECT ON report.report, report.threshold TO cella_guards;
