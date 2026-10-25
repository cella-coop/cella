CREATE SCHEMA project_timesheet_worker;

-- project-timesheet-worker:entry:book — a worker books their own time to
-- a project by their employment, member or not, where project-timesheet's
-- booking is the timesheet feat's log and needs the log-time mandate a
-- seat gives. The entry is judged as timesheet-worker's log is: the
-- actor's own, on a day that has come (`timesheet.logs`), while they are
-- employed (`timesheet_worker.works`); the booking by project-timesheet's
-- trigger, a project that exists and is not archived.
INSERT INTO cella.rule (op, fn, owner) VALUES
  ('project-timesheet-worker:entry:book', 'timesheet.logs(jsonb)', 'project-timesheet-worker'),
  ('project-timesheet-worker:entry:book', 'timesheet_worker.works(jsonb)', 'project-timesheet-worker');

GRANT USAGE ON SCHEMA project_timesheet_worker TO cella_app, cella_rules;
