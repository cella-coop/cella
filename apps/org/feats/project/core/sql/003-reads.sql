-- Who reads projects beside core's row-level policy, which reads them by
-- `read`: whoever holds a power over them, in the circles its mandate
-- covers, since what a mandate acts on its holder reads.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('project', NULL, 'manage-project', 'project'),
  ('project', NULL, 'set-budget', 'project');
