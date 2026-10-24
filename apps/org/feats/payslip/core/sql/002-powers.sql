-- The power each payslip write needs; the circle-member graft's rule checks
-- that the actor holds it. Wages are owed whatever their size, so none has
-- a limit: preparing a run is finance's, approving it the gérante's, and
-- paying it, the one way money leaves the bank for pay, finance's again.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('payslip:run:generate', 'prepare-payroll', NULL, 'payslip'),
  ('payslip:run:approve', 'approve-payroll', NULL, 'payslip'),
  ('payslip:run:pay', 'pay-payroll', NULL, 'payslip');
