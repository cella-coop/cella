-- The powers that open a class of personal files are the powers that read
-- them: the file feat's policy lets a holder see the file, its name and
-- its bytes, as `opens` lets them open it.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('file', 'expense-receipt', 'approve-expense', 'file-membership'),
  ('file', 'expense-receipt', 'reimburse-expense', 'file-membership'),
  ('file', 'payroll', 'approve-payroll', 'file-membership'),
  ('file', 'payroll', 'pay-payroll', 'file-membership'),
  ('file', 'payroll', 'hire-worker', 'file-membership'),
  ('file', 'profile', 'invite-member', 'file-membership');
