-- What of a worker is personal data: their name, of class `payroll`, since
-- the register of the staff keeps it five years after they leave (Code du
-- travail, art. R1221-26); erasing them restricts it until then. Their
-- address is the pseudonym every entry names them by; their job and
-- contract are the co-op's.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('worker', 'worker', 'name', 'payroll', 'address', 'worker');

COMMENT ON COLUMN worker.worker.address IS 'not personal: the pseudonymous address every log entry names the worker by';
