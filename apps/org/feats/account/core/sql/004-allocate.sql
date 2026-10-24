-- Allocating a surplus is the assembly's decision once the account-decision
-- graft's junction is built; until then it needs a power no Lanterne
-- mandate grants, so it is never allowed by omission.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:surplus:allocate', 'allocate-surplus', NULL, 'account');
