-- The power each person write needs. Keeping one's profile and devices is
-- every person's right: the circle-membership graft's guard checks the
-- actor holds it, and person.own_profile, person.forgets, person.enrols
-- and person.revokes that what they keep is their own. Recovery from
-- guardian shares is not built: until it is, it needs a power no
-- Lanterne mandate grants.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('person:person:profile', 'keep-profile', NULL, 'person'),
  ('person:person:forget', 'keep-profile', NULL, 'person'),
  ('person:device:enrol', 'keep-devices', NULL, 'person'),
  ('person:device:revoke', 'keep-devices', NULL, 'person'),
  ('person:device:recover', 'recover-key', NULL, 'person');
