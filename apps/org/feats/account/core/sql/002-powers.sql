-- The power each account write needs; the membership feat's guard checks
-- that the actor holds it. Drawing on one's account, against its draw
-- limit, and spreading what one owes over one's pay are every member's
-- right, the grafts that judge them checking it is their own; adopting
-- terms is the members' motion, so it is not here.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:period:close', 'close-period', NULL, 'account'),
  ('account:account:draw', 'draw-account', NULL, 'account'),
  ('account:capital:spread', 'spread-capital', NULL, 'account');
