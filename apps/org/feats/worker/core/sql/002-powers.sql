-- The power a hire needs; the circle-member graft's rule checks that the
-- actor holds it. A hire commits the co-op to a contract, so it is the
-- manager's, with no limit: what a salary costs is the payslip feat's.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('worker:worker:hire', 'hire-worker', NULL, 'worker');
