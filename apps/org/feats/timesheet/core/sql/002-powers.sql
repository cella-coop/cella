-- The power each timesheet write needs; the circle-member graft's rule
-- checks that the actor holds it. Logging and submitting are also the
-- member's own, by `timesheet.logs` and `timesheet.submits`; approving is
-- never one's own, by `timesheet.approves`.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('timesheet:entry:log', 'log-time', NULL, 'timesheet'),
  ('timesheet:period:submit', 'log-time', NULL, 'timesheet'),
  ('timesheet:period:approve', 'approve-time', NULL, 'timesheet');
