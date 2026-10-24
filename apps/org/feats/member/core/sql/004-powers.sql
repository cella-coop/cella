-- The power each member write without a decision or a self check needs;
-- the circle-member graft's rule checks that the actor holds it. Admission
-- is decided and a profile is the member's own, so neither is here.
-- Suspension and exit are decided too once their decisions' junctions
-- exist; until then they need a power no Lanterne mandate grants.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('member:member:invite', 'invite-member', NULL, 'member'),
  ('member:member:suspend', 'end-membership', NULL, 'member'),
  ('member:member:exit', 'end-membership', NULL, 'member');
