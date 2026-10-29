-- The timesheet feat's analytical contract: each month's time in minutes,
-- summed over every entry. An entry is its member's, so no row is one
-- member's time.
CREATE VIEW timesheet.months AS
SELECT to_char(e.day, 'YYYY-MM') AS month, count(*)::bigint AS entries,
       count(DISTINCT e.member)::bigint AS members,
       coalesce(sum(e.minutes), 0)::bigint AS minutes,
       coalesce(sum(e.minutes) FILTER (WHERE e.billable), 0)::bigint AS billable
FROM timesheet.entry e
GROUP BY to_char(e.day, 'YYYY-MM');
