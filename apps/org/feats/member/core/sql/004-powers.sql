-- The power each member write without a decision or a self check needs;
-- the circle-member graft's rule checks that the actor holds it.
-- Admission, suspension and exit are decided, and a profile is the
-- member's own, so none of them is here.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('member:member:invite', 'invite-member', NULL, 'member');
