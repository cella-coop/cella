-- The power each account write needs; the circle-member graft's rule checks
-- that the actor holds it. A draw's budget, a total over a month, needs
-- spend tracking that is not built: only the power is checked.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:account:draw', 'spend-circle', NULL, 'account'),
  ('account:period:close', 'close-period', NULL, 'account');
