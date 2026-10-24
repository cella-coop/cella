-- Assigning a task is editing it, so it needs edit-task; the circle-member
-- graft's rule checks that the actor holds it.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('member-task:task:assign', 'edit-task', NULL, 'member-task');
