-- The power each member write without a motion needs; the
-- circle-membership graft's guard checks that the actor holds it.
-- Admission, suspension and exclusion are decided, and a profile is the
-- member's own, so none of them is here. A withdrawal is the member's
-- own right, `withdraw-membership`, held as every person's, since the
-- write ends the membership on its own verdict date: that it is the
-- actor's own is `membership.withdraws`.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('membership:member:invite', 'invite-member', NULL, 'membership'),
  ('membership:member:withdraw', 'withdraw-membership', NULL, 'membership');
