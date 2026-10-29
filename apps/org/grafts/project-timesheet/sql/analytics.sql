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

CREATE VIEW project_timesheet.rates AS
SELECT r.since, cella.cents(r.hourly) AS hourly
FROM project_timesheet.rate r;

CREATE VIEW project_timesheet.costs AS
SELECT c.since, cella.cents(c.hourly) AS hourly
FROM project_timesheet.cost c;
