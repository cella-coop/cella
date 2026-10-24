-- The power each circle write but a message needs; the circle-member
-- graft's rule checks that the actor holds it, and posting to a circle's
-- channel needs a seat in it, the same graft's rule. Nesting circles and
-- granting mandates are the assembly's decisions once their decisions'
-- junctions exist; until then they need powers no Lanterne mandate grants.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('circle:circle:nest', 'organise-circles', NULL, 'circle'),
  ('circle:mandate:grant', 'grant-mandate', NULL, 'circle'),
  ('circle:mandate:revoke', 'grant-mandate', NULL, 'circle');
