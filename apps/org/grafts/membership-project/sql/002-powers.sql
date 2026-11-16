-- Granting a share of a budget is setting how it is spent, so it needs
-- set-budget, capped by the mandate's limit for the share's amount; the
-- membership feat's guard checks that the actor holds it.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('membership-project:project:share', 'set-budget', 'amount', 'membership-project');

-- Setting a project's crew is managing it, so it needs manage-project;
-- the membership feat's guard checks that the actor holds it.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('membership-project:project:crew', 'manage-project', NULL, 'membership-project');
