-- Linking an invoice to the client it bills is invoicing, so it needs
-- issue-invoice; the circle-membership graft's guard checks that the actor
-- holds it.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('client-invoice:billing:link', 'issue-invoice', NULL, 'client-invoice');
