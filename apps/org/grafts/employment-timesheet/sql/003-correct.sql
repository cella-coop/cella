-- employment-timesheet:entry:correct — a worker corrects their own entry
-- by their employment, as they log it: the actor is a worker employed on
-- the entry's day. That it is their own entry, brought down to the time
-- the write names, is the timesheet feat's guard, run on this op too.
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('employment-timesheet:entry:correct', 'timesheet.corrects(jsonb)', 'employment-timesheet'),
  ('employment-timesheet:entry:correct', 'employment_timesheet.works(jsonb)', 'employment-timesheet');

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('employment-timesheet:entry:correct', 'log-own-time', NULL, 'employment-timesheet');
