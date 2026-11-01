-- Who reads time: a member their own entries and months; whoever approves
-- time, prepares the pay runs or distributes the surplus, which divides by
-- the hours worked, everyone's. A write's transaction sees every row, as
-- its guards do.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('timesheet', NULL, 'approve-time', 'timesheet'),
  ('timesheet', NULL, 'prepare-payroll', 'timesheet'),
  ('timesheet', NULL, 'distribute-surplus', 'timesheet');

ALTER TABLE timesheet.entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet.period ENABLE ROW LEVEL SECURITY;

CREATE POLICY reads ON timesheet.entry FOR SELECT TO cella_app USING ((SELECT cella.sees('timesheet')) OR member = cella.reader() OR cella.reaches('timesheet', member));
CREATE POLICY reads ON timesheet.period FOR SELECT TO cella_app USING ((SELECT cella.sees('timesheet')) OR member = cella.reader() OR cella.reaches('timesheet', member));

CREATE POLICY guards ON timesheet.entry FOR SELECT TO cella_guards USING (true);
CREATE POLICY guards ON timesheet.period FOR SELECT TO cella_guards USING (true);

CREATE POLICY writes ON timesheet.entry FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY writes ON timesheet.period FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY changes ON timesheet.period FOR UPDATE TO cella_app USING (true);

-- A month's sheet reads its entries and its period as its reader may.
ALTER VIEW timesheet.sheet SET (security_invoker = true);
