-- The power each invoice write needs; the circle-member graft's rule checks
-- that the actor holds it.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('invoice:invoice:issue', 'issue-invoice', NULL, 'invoice'),
  ('invoice:invoice:send', 'issue-invoice', NULL, 'invoice'),
  ('invoice:invoice:payment', 'record-receipt', NULL, 'invoice'),
  ('invoice:invoice:void', 'issue-invoice', NULL, 'invoice');
