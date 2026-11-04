-- What an hour of the co-op's time costs it, from a day on, in cents: pay
-- and the employer's contributions over the hours worked. A parameter, as
-- the billable rate is, seeded with the co-op's figure; a cost per member,
-- or one read from the pay runs, is not built.
CREATE TABLE project_timesheet.cost (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  since date PRIMARY KEY,
  hourly cella.amount NOT NULL
);

-- Each booked entry with, after the billable rate, the cost rate in force
-- on its day.
CREATE OR REPLACE VIEW project_timesheet.costed AS
SELECT b.project, e.id AS entry, e.member, e.day, e.minutes / 60.0 AS hours, e.billable,
       (SELECT cella.cents(r.hourly) FROM project_timesheet.rate r WHERE r.since <= e.day ORDER BY r.since DESC LIMIT 1) AS hourly,
       (SELECT cella.cents(c.hourly) FROM project_timesheet.cost c WHERE c.since <= e.day ORDER BY c.since DESC LIMIT 1) AS cost
FROM project_timesheet.booking b
JOIN timesheet.entry e ON e.id = b.entry;

-- Each project's time, and now what it cost the co-op: every hour, billable
-- or not, at the cost rate, in cents.
CREATE OR REPLACE VIEW project_timesheet.burn AS
SELECT project,
       sum(hours)::numeric(8, 2) AS hours,
       coalesce(sum(hours) FILTER (WHERE billable), 0)::numeric(8, 2) AS billable,
       coalesce(round(sum(hours * hourly) FILTER (WHERE billable)), 0)::bigint AS spent,
       coalesce(round(sum(hours * cost)), 0)::bigint AS cost
FROM project_timesheet.costed
GROUP BY project;

-- How far through its span a project is on a day, from 0 on the day it
-- starts to 1 on its due day, once archived or once every milestone is
-- complete; unknown for a live project with no due day.
CREATE FUNCTION project_timesheet.elapsed(started date, due date, archived date, done boolean, day date) RETURNS numeric
LANGUAGE sql IMMUTABLE
RETURN CASE
  WHEN archived IS NOT NULL OR done THEN 1
  WHEN due IS NULL THEN NULL
  WHEN day >= due THEN 1
  WHEN day <= started THEN 0
  ELSE round((day - started)::numeric / greatest(due - started, 1), 4)
END;

-- Each project's budget burn on a day: what its billable time spent, the
-- share of its budget that is, how far through its span it is, and what
-- it will have spent at completion at the pace so far.
CREATE FUNCTION project_timesheet.forecast(day date)
RETURNS TABLE (project text, budget bigint, spent bigint, burn numeric, elapsed numeric, forecast bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT p.id, cella.cents(p.budget)::bigint, coalesce(b.spent, 0)::bigint,
         CASE WHEN p.budget IS NOT NULL AND cella.cents(p.budget) > 0 THEN round(100.0 * coalesce(b.spent, 0) / cella.cents(p.budget), 1) END,
         x.elapsed,
         CASE WHEN x.elapsed > 0 THEN round(coalesce(b.spent, 0) / x.elapsed)::bigint END
  FROM project.project p
  JOIN project.progress g ON g.id = p.id
  LEFT JOIN project_timesheet.burn b ON b.project = p.id
  CROSS JOIN LATERAL (
    SELECT project_timesheet.elapsed(p.started, p.due, p.archived, g.milestones > 0 AND g.completed = g.milestones, forecast.day) AS elapsed
  ) x;
END;

GRANT SELECT ON project_timesheet.cost TO cella_app, cella_guards;
