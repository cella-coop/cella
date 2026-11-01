CREATE SCHEMA employment_project_timesheet;

-- The graft has no action of its own: a worker's week books each cell
-- through project-timesheet's booking or logs it by the timesheet feat's
-- log, both `timesheet:entry:log`, which need `log-time`, every
-- employee's right, and are judged by that op's guards.
GRANT USAGE ON SCHEMA employment_project_timesheet TO cella_app, cella_guards;
