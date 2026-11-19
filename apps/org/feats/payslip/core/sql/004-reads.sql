-- Who reads pay, in place of core's row-level policy, which `read` would
-- open: a member their own salary and payslips, and the pay runs they are
-- paid in; whoever prepares, approves or pays the pay runs, those of the
-- circles their mandates cover, the whole coop's. A write's transaction sees every row, as its guards do.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('payslip', NULL, 'prepare-payroll', 'payslip'),
  ('payslip', NULL, 'approve-payroll', 'payslip'),
  ('payslip', NULL, 'pay-payroll', 'payslip');

ALTER TABLE payslip.salary ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslip.payslip ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslip.run ENABLE ROW LEVEL SECURITY;

DROP POLICY circle ON payslip.salary;
CREATE POLICY reads ON payslip.salary FOR SELECT TO cella_app USING ((SELECT cella.sees('payslip')) OR circle = ANY ((SELECT cella.circles('payslip'))::text[]) OR member = cella.reader() OR cella.reaches('payslip', member));
DROP POLICY circle ON payslip.payslip;
CREATE POLICY reads ON payslip.payslip FOR SELECT TO cella_app USING ((SELECT cella.sees('payslip')) OR circle = ANY ((SELECT cella.circles('payslip'))::text[]) OR member = cella.reader() OR cella.reaches('payslip', member));
DROP POLICY circle ON payslip.run;
CREATE POLICY reads ON payslip.run FOR SELECT TO cella_app
  USING ((SELECT cella.sees('payslip')) OR circle = ANY ((SELECT cella.circles('payslip'))::text[]) OR EXISTS (SELECT FROM payslip.payslip p WHERE p.month = run.month AND p.member = cella.reader()));

CREATE POLICY guards ON payslip.salary FOR SELECT TO cella_guards USING (true);
CREATE POLICY guards ON payslip.payslip FOR SELECT TO cella_guards USING (true);
CREATE POLICY guards ON payslip.run FOR SELECT TO cella_guards USING (true);

CREATE POLICY writes ON payslip.payslip FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY changes ON payslip.payslip FOR UPDATE TO cella_app USING (true);
CREATE POLICY writes ON payslip.run FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY changes ON payslip.run FOR UPDATE TO cella_app USING (true);
