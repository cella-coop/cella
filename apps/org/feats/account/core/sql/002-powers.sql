-- The power each account write needs; the circle-membership graft's guard checks
-- that the actor holds it. A draw is the member's own, against their draw
-- limit, and adopting terms is the members' decision, so neither is here.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:period:close', 'close-period', NULL, 'account');
