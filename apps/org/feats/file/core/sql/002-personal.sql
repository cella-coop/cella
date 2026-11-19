-- What of a file is personal data: the name and the bytes of each
-- personal class's part, under that class and the subject the file
-- concerns. A receipt is a supporting voucher, kept ten years (Code de
-- commerce, art. L123-22); an employment record, such as a contract, is
-- payroll, kept five (Code du travail, art. L3243-4); a member's record
-- is their profile's, erased when asked. Redacting the bytes empties the
-- hash generated from them. The coop's own files hold none.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('file', 'receipt', 'name', 'expense-receipt', 'subject', 'file'),
  ('file', 'receipt', 'bytes', 'expense-receipt', 'subject', 'file'),
  ('file', 'contract', 'name', 'payroll', 'subject', 'file'),
  ('file', 'contract', 'bytes', 'payroll', 'subject', 'file'),
  ('file', 'record', 'name', 'profile', 'subject', 'file'),
  ('file', 'record', 'bytes', 'profile', 'subject', 'file');

COMMENT ON COLUMN file.file.name IS 'not personal: the coop''s own files'' names; each personal class''s part, file.receipt, file.contract and file.record, registers its own';
