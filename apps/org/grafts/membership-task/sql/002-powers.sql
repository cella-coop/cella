-- Assigning a task is editing it, so it needs edit-task; the circle-membership
-- graft's guard checks that the actor holds it.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('membership-task:task:assign', 'edit-task', NULL, 'membership-task');
