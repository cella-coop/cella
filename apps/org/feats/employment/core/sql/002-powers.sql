-- The power a hire needs; the membership feat's guard checks that the
-- actor holds it. A hire commits the co-op to a contract, so it is the
-- manager's, with no limit: what a salary costs is the payslip feat's.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('employment:worker:hire', 'hire-worker', NULL, 'employment');
