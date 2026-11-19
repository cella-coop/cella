CREATE SCHEMA project_timesheet;

-- Which project an entry's time is for. An entry with no row here is the
-- coop's own time, not invalid.
CREATE TABLE project_timesheet.booking (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  entry bigint PRIMARY KEY,
  project text NOT NULL
);

CREATE INDEX ON project_timesheet.booking (project);

-- The hourly rate a project's budget is spent at by billable time, from a
-- day on: Lanterne's day rate over its seven-hour day. Set by
-- coordination with the rate card; a rate per project or per client is
-- not built.
CREATE TABLE project_timesheet.rate (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  since date PRIMARY KEY,
  hourly cella.amount NOT NULL
);

-- Both sides resolve: the entry exists, and its project exists and is not
-- archived.
CREATE FUNCTION project_timesheet.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  archived date;
BEGIN
  IF NOT EXISTS (SELECT FROM timesheet.entry e WHERE e.id = NEW.entry) THEN
    RAISE EXCEPTION 'no entry %', NEW.entry USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT p.archived INTO archived FROM project.project p WHERE p.id = NEW.project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no project %', NEW.project USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF archived IS NOT NULL THEN
    RAISE EXCEPTION '% was archived on %: it takes no time', NEW.project, archived USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON project_timesheet.booking
  FOR EACH ROW EXECUTE FUNCTION project_timesheet.resolves();

-- Each booked entry with the rate in force on its day, in cents an hour.
CREATE VIEW project_timesheet.costed AS
SELECT b.project, e.id AS entry, e.member, e.day, e.minutes / 60.0 AS hours, e.billable,
       (SELECT cella.cents(r.hourly) FROM project_timesheet.rate r WHERE r.since <= e.day ORDER BY r.since DESC LIMIT 1) AS hourly
FROM project_timesheet.booking b
JOIN timesheet.entry e ON e.id = b.entry;

-- Each project's time: its hours, its billable hours, and what that time
-- spent of the budget, billable hours at the rate, in cents.
CREATE VIEW project_timesheet.burn AS
SELECT project,
       sum(hours)::numeric(8, 2) AS hours,
       coalesce(sum(hours) FILTER (WHERE billable), 0)::numeric(8, 2) AS billable,
       coalesce(round(sum(hours * hourly) FILTER (WHERE billable)), 0)::bigint AS spent
FROM project_timesheet.costed
GROUP BY project;

GRANT USAGE ON SCHEMA project_timesheet TO cella_app, cella_guards;
GRANT SELECT ON project_timesheet.booking, project_timesheet.rate, project_timesheet.costed, project_timesheet.burn TO cella_app, cella_guards;
GRANT INSERT ON project_timesheet.booking TO cella_app;
