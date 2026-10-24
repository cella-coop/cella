-- Enrolling and revoking a device are the member's own, checked by
-- key.enrols and key.revokes. Recovery from guardian shares is not built:
-- until it is, it needs a power no Lanterne mandate grants.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('key:key:recover', 'recover-key', NULL, 'key');
