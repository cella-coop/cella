-- The power each client write needs; the circle-membership graft's rule checks
-- that the actor holds it. A co-op where every member edits clients grants
-- it through a mandate like any other, so nothing is allowed by omission.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('client:client:add', 'edit-client', NULL, 'client'),
  ('client:client:update', 'edit-client', NULL, 'client'),
  ('client:client:archive', 'edit-client', NULL, 'client');
