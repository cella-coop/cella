-- What of a worker is personal data: the name the register of the staff
-- holds, of class `payroll`, copied from the person's at their hire, since
-- the register keeps it five years after they leave (Code du travail, art.
-- R1221-26), when the person's own name may be erased at once; erasing
-- them restricts it until then. Their address is the pseudonym every entry
-- names them by; their job and contract are the co-op's.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('employment', 'worker', 'name', 'payroll', 'address', 'employment');

COMMENT ON COLUMN employment.worker.address IS 'not personal: the pseudonymous address every log entry names the worker by';
