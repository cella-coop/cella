CREATE SCHEMA employment_project_timesheet;

-- employment-project-timesheet:entry:book — a worker books their own time to
-- a project by their employment, member or not, where project-timesheet's
-- booking is the timesheet feat's log and needs the log-time mandate a
-- seat gives. The entry is judged as employment-timesheet's log is: the
-- actor's own, on a day that has come (`timesheet.logs`), while they are
-- employed (`employment_timesheet.works`); the booking by project-timesheet's
-- trigger, a project that exists and is not archived.
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('employment-project-timesheet:entry:book', 'timesheet.logs(jsonb)', 'employment-project-timesheet'),
  ('employment-project-timesheet:entry:book', 'employment_timesheet.works(jsonb)', 'employment-project-timesheet');

-- Booking one's own time to a project is every employee's right, as
-- logging it is: `log-own-time`.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('employment-project-timesheet:entry:book', 'log-own-time', NULL, 'employment-project-timesheet');

GRANT USAGE ON SCHEMA employment_project_timesheet TO cella_app, cella_guards;
