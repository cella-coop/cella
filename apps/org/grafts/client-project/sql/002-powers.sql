-- Naming the client a project is for is running the project, so it needs
-- manage-project; the membership feat's guard checks that the actor
-- holds it.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('client-project:project:link', 'manage-project', NULL, 'client-project');
