CREATE SCHEMA report;

-- The four reports the feat draws itself, the same in every scope: a
-- registry its migration fills, owned by no circle.
CREATE TABLE report.drawn (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]*$'),
  title text NOT NULL CHECK (title <> ''),
  caption text NOT NULL DEFAULT '',
  kind text NOT NULL UNIQUE CHECK (kind IN ('income', 'balance', 'margins', 'federation'))
);

COMMENT ON TABLE report.drawn IS 'registry: the reports the feat draws itself, the same in every scope';

INSERT INTO report.drawn (id, title, caption, kind) VALUES
  ('income', 'Income statement', 'Income less expenses over a span, against the span before it, in the PCG''s rubrics', 'income'),
  ('balance', 'Balance sheet', 'What the coop owns and owes at the end of a span, against the span before it', 'balance'),
  ('margins', 'Project margins', 'Each project''s margin, budget burn and forecasts, and the projects to watch', 'margins'),
  ('federation', 'Federation figures', 'A distributed year''s split, what it posted and the capital it credited', 'federation');

-- The members' own reports, each a port report as JSON with how it is
-- charted, its keys in the order they were written, which orders its
-- columns, saved by its owner on a day.
CREATE TABLE report.report (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]*$'),
  title text NOT NULL CHECK (title <> ''),
  caption text NOT NULL DEFAULT '',
  definition json NOT NULL,
  owner text NOT NULL,
  saved date NOT NULL
);

-- Every report the collection lists: those the feat draws, which no
-- circle owns, then the members' own, of kind `custom`, each under the
-- circle that owns it.
CREATE VIEW report.listed WITH (security_invoker = true) AS
  SELECT d.id, d.title, d.caption, d.kind, NULL::json AS definition, NULL::text AS owner, NULL::date AS saved, NULL::text AS circle FROM report.drawn d
  UNION ALL
  SELECT r.id, r.title, r.caption, 'custom', r.definition, r.owner, r.saved, r.circle FROM report.report r;

-- When a project is watched, from a day on: once its billable time has
-- spent `burn` percent of its budget, or once what it invoiced keeps less
-- than `margin` percent after its costs. A parameter, seeded with the
-- coop's figures; a threshold per project is not built.
CREATE TABLE report.threshold (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
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
    WHEN d.id IS NOT NULL THEN d.id || ' is a report the feat draws itself, saved by no one'
    WHEN r.id IS NULL THEN 'no report ' || coalesce(x.id, 'is named')
    WHEN r.owner IS DISTINCT FROM cella.actor() THEN r.id || ' is ' || r.owner || '''s report, not ' || coalesce(cella.actor(), 'no one') || '''s'
    WHEN r.saved IS DISTINCT FROM cella.verdict_date() THEN r.id || ' was not saved by this write'
    WHEN json_typeof(r.definition -> 'from') IS DISTINCT FROM 'object' OR (r.definition -> 'from')::jsonb = '{}'::jsonb
      THEN r.id || ' reads no view'
  END
  FROM (SELECT saves.payload ->> 'report' AS id) x
  LEFT JOIN report.drawn d ON d.id = x.id
  LEFT JOIN report.report r ON r.id = x.id;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('report:report:save', 'report.saves(jsonb)', 'report');

-- Saving a report is every member's right; report.saves checks it is
-- their own.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('report:report:save', 'save-report', NULL, 'report');

GRANT USAGE ON SCHEMA report TO cella_app, cella_guards;
GRANT SELECT, INSERT, UPDATE ON report.report TO cella_app;
GRANT SELECT ON report.drawn, report.listed, report.threshold TO cella_app;
GRANT SELECT ON report.drawn, report.report, report.threshold TO cella_guards;
