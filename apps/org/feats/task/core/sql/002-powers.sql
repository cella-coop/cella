-- The power each task write needs; the circle-member graft's rule checks
-- that the actor holds it. At Lanterne every member holds it, through the
-- member role's mandate, so a non-member's device is refused.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('task:task:create', 'edit-task', NULL, 'task'),
  ('task:task:move', 'edit-task', NULL, 'task'),
  ('task:task:complete', 'edit-task', NULL, 'task');
