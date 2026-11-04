-- Who reads bills beside core's row-level policy, which reads them by
-- `read`: whoever holds a power over them, in the circles its mandate
-- covers, since what a mandate acts on its holder reads.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('bill', NULL, 'approve-bill', 'bill'),
  ('bill', NULL, 'pay-supplier', 'bill'),
  ('bill', NULL, 'record-bill', 'bill');
