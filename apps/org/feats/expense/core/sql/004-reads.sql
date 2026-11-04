-- Who reads expenses beside core's row-level policy, which reads them by
-- `read`: whoever holds a power over them, in the circles its mandate
-- covers, since what a mandate acts on its holder reads.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('expense', NULL, 'approve-expense', 'expense'),
  ('expense', NULL, 'reimburse-expense', 'expense');

-- A member reads their own claims whatever circle they are spent for.
CREATE POLICY own ON expense.expense FOR SELECT TO cella_app USING (member = cella.reader());
