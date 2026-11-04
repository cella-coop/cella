-- Naming the project an invoice bills is invoicing, so it needs
-- issue-invoice; the membership feat's guard checks that the actor
-- holds it.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('invoice-project:invoice:link', 'issue-invoice', NULL, 'invoice-project');
