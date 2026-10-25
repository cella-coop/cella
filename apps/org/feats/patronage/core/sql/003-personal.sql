-- A part's quantity and amount are what a worker was paid or worked and
-- what it earned them: personal data of class `payroll`, registered by the
-- worker, kept five years (Code du travail, art. L3243-4) and redacted
-- after.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('patronage', 'part', 'quantity', 'payroll', 'worker', 'patronage'),
  ('patronage', 'part', 'amount', 'payroll', 'worker', 'patronage');
