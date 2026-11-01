-- The power each bill write needs; the circle-membership graft's guard
-- checks that the actor holds it. Approving and paying are capped by the
-- mandate's limit for the bill's total; money leaves the bank under
-- pay-supplier, the power a payment without a bill needs too.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('bill:bill:record', 'record-bill', NULL, 'bill'),
  ('bill:bill:approve', 'approve-bill', 'amount', 'bill'),
  ('bill:bill:pay', 'pay-supplier', 'amount', 'bill');
