-- A task's title may name a person, in the words its maker gave: personal
-- data of class `profile`, erased when asked. No column names whose it
-- is, so its subject is the task, as a contact is its own. A write
-- commits to it in the log, and the vault keeps it.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('task', 'task', 'title', 'profile', 'id', 'task');
