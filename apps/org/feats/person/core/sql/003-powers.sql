-- Enrolling and revoking a device are the person's own, checked by
-- person.enrols and person.revokes. Recovery from guardian shares is not built:
-- until it is, it needs a power no Lanterne mandate grants.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('person:device:recover', 'recover-key', NULL, 'person');
