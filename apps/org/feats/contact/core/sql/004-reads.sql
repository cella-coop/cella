-- Who reads contacts beside core's row-level policy, which reads them by
-- `read`: whoever holds a power over them, in the circles its mandate
-- covers, since what a mandate acts on its holder reads.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('contact', NULL, 'edit-contact', 'contact'),
  ('contact', NULL, 'erase-personal-data', 'contact');
