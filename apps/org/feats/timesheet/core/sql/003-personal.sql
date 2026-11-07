-- A time entry's note says what the time was spent on in its member's
-- own words: personal data of its member, of class `payroll`, as their
-- minutes are (`006-salted.sql`). A log commits to it in the log, and the
-- vault keeps it.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('timesheet', 'entry', 'note', 'payroll', 'member', 'timesheet');
