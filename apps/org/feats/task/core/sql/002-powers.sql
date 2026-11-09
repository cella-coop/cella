-- The power each task write needs; the membership feat's guard checks
-- that the actor holds it. At Lanterne every member holds it, through the
-- member role's mandate, so a non-member's device is refused. Saving a
-- task's body, and posting and resolving its comments, need `discuss` in
-- its circle, which every seat there holds.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('task:task:create', 'edit-task', NULL, 'task'),
  ('task:task:move', 'edit-task', NULL, 'task'),
  ('task:task:complete', 'edit-task', NULL, 'task'),
  ('task:body:save', 'discuss', NULL, 'task'),
  ('task:comment:post', 'discuss', NULL, 'task'),
  ('task:comment:resolve', 'discuss', NULL, 'task');
