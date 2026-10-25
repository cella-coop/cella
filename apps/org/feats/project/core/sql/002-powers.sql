-- The power each project write needs; the circle-membership graft's rule
-- checks that the actor holds it. Setting a budget names its amount, so a
-- mandate's limit caps the pot a holder may set.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('project:project:create', 'manage-project', NULL, 'project'),
  ('project:milestone:add', 'manage-project', NULL, 'project'),
  ('project:milestone:complete', 'manage-project', NULL, 'project'),
  ('project:project:budget', 'set-budget', 'amount', 'project'),
  ('project:project:archive', 'manage-project', NULL, 'project');
