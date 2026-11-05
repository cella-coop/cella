-- The project-timesheet graft's analytical contract: each project's time by
-- month in minutes, summed over every member, with what its billable time
-- spent at the billing rate and what all of it cost at the cost rate, in
-- exact cents, which a report rounds once over the months it sums; and
-- both rates by the day they apply from. An entry is its member's, so no
-- row is one member's time.
CREATE VIEW project_timesheet.months AS
SELECT b.project, to_char(e.day, 'YYYY-MM') AS month,
       coalesce(sum(e.minutes), 0)::bigint AS minutes,
       coalesce(sum(e.minutes) FILTER (WHERE e.billable), 0)::bigint AS billable,
       coalesce(sum(e.minutes * r.hourly / 60.0) FILTER (WHERE e.billable), 0) AS spent,
       coalesce(sum(e.minutes * c.hourly / 60.0), 0) AS cost
FROM project_timesheet.booking b
JOIN timesheet.entry e ON e.id = b.entry
LEFT JOIN LATERAL (SELECT cella.cents(x.hourly) AS hourly FROM project_timesheet.rate x WHERE x.since <= e.day ORDER BY x.since DESC LIMIT 1) r ON true
LEFT JOIN LATERAL (SELECT cella.cents(x.hourly) AS hourly FROM project_timesheet.cost x WHERE x.since <= e.day ORDER BY x.since DESC LIMIT 1) c ON true
GROUP BY b.project, to_char(e.day, 'YYYY-MM');
COMMENT ON VIEW project_timesheet.months IS 'audience: shared by project, month';

CREATE VIEW project_timesheet.rates AS
SELECT r.since, cella.cents(r.hourly) AS hourly, r.circle
FROM project_timesheet.rate r;
COMMENT ON VIEW project_timesheet.rates IS 'audience: scoped by circle';

CREATE VIEW project_timesheet.costs AS
SELECT c.since, cella.cents(c.hourly) AS hourly, c.circle
FROM project_timesheet.cost c;
COMMENT ON VIEW project_timesheet.costs IS 'audience: scoped by circle';

-- Each project's burn on the scope's day, as `forecast` reads it: what its
-- billable time spent at the billing rate and all its time cost at the
-- cost rate, in cents; the share of its budget spent; how far through its
-- span it is; and its spend at completion at the pace so far.
CREATE VIEW project_timesheet.forecasts AS
SELECT p.id AS project, cella.verdict_date() AS day, cella.cents(p.budget)::bigint AS budget,
       coalesce(round(sum(t.hours * t.hourly) FILTER (WHERE t.billable)), 0)::bigint AS spent,
       coalesce(round(sum(t.hours * t.cost)), 0)::bigint AS cost,
       CASE WHEN cella.cents(p.budget) > 0
            THEN round(100.0 * coalesce(round(sum(t.hours * t.hourly) FILTER (WHERE t.billable)), 0) / cella.cents(p.budget), 1) END AS burn,
       project_timesheet.elapsed(p.started, p.due, p.archived, bool_and(g.milestones > 0 AND g.completed = g.milestones), cella.verdict_date()) AS elapsed,
       CASE WHEN project_timesheet.elapsed(p.started, p.due, p.archived, bool_and(g.milestones > 0 AND g.completed = g.milestones), cella.verdict_date()) > 0
            THEN round(coalesce(round(sum(t.hours * t.hourly) FILTER (WHERE t.billable)), 0)
                       / project_timesheet.elapsed(p.started, p.due, p.archived, bool_and(g.milestones > 0 AND g.completed = g.milestones), cella.verdict_date()))::bigint END AS forecast
FROM project.project p
CROSS JOIN LATERAL (
  SELECT count(*) AS milestones, count(*) FILTER (WHERE m.completed IS NOT NULL) AS completed
  FROM project.milestone m WHERE m.project = p.id
) g
LEFT JOIN (
  SELECT b.project, e.minutes / 60.0 AS hours, e.billable, r.hourly, c.hourly AS cost
  FROM project_timesheet.booking b
  JOIN timesheet.entry e ON e.id = b.entry
  LEFT JOIN LATERAL (SELECT cella.cents(x.hourly) AS hourly FROM project_timesheet.rate x WHERE x.since <= e.day ORDER BY x.since DESC LIMIT 1) r ON true
  LEFT JOIN LATERAL (SELECT cella.cents(x.hourly) AS hourly FROM project_timesheet.cost x WHERE x.since <= e.day ORDER BY x.since DESC LIMIT 1) c ON true
) t ON t.project = p.id
GROUP BY p.id;
COMMENT ON VIEW project_timesheet.forecasts IS 'audience: shared by project';

-- Each person's time on each project, by month and over its life, which
-- the port reads to withhold a cell too few people or one or two of them
-- make, and no report reads.
CREATE VIEW project_timesheet.months_contributions AS
SELECT b.project, to_char(e.day, 'YYYY-MM') AS month, e.member AS person, e.circle, coalesce(sum(e.minutes), 0)::bigint AS amount
FROM project_timesheet.booking b
JOIN timesheet.entry e ON e.id = b.entry
GROUP BY b.project, to_char(e.day, 'YYYY-MM'), e.member, e.circle;
COMMENT ON VIEW project_timesheet.months_contributions IS 'audience: contributions to project_timesheet.months, read by timesheet';
COMMENT ON COLUMN project_timesheet.months_contributions.person IS 'personal: whose time it is, which only the port reads';

CREATE VIEW project_timesheet.forecasts_contributions AS
SELECT b.project, e.member AS person, e.circle, coalesce(sum(e.minutes), 0)::bigint AS amount
FROM project_timesheet.booking b
JOIN timesheet.entry e ON e.id = b.entry
GROUP BY b.project, e.member, e.circle;
COMMENT ON VIEW project_timesheet.forecasts_contributions IS 'audience: contributions to project_timesheet.forecasts, read by timesheet';
COMMENT ON COLUMN project_timesheet.forecasts_contributions.person IS 'personal: whose time it is, which only the port reads';
