-- Filing a task under a project is editing the task, so it needs
-- edit-task; the circle-member graft's rule checks that the actor holds
-- it.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('project-task:task:file', 'edit-task', NULL, 'project-task');
