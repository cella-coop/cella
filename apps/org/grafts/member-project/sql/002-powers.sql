-- Granting a share of a budget is setting how it is spent, so it needs
-- set-budget, capped by the mandate's limit for the share's amount; the
-- circle-member graft's rule checks that the actor holds it.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('member-project:project:share', 'set-budget', 'amount', 'member-project');
