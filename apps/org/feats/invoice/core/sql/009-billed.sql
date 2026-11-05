-- The name and address an invoice bills may be a person's, a client who
-- is one, and the reason for its void is free text: personal data of
-- class `books`, kept ten years as the books keep a mention (Code de
-- commerce, art. L123-22). No column of an invoice says whose they are,
-- so their subject is the invoice itself, as a contact's are the
-- contact's: an issue and a void commit to them in the log, the vault
-- keeps them, and their clock running out redacts them, which
-- `invoice.stays_issued` lets through.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('invoice', 'invoice', 'bill_to', 'books', 'id', 'invoice'),
  ('invoice', 'invoice', 'bill_address', 'books', 'id', 'invoice'),
  ('invoice', 'invoice', 'reason', 'books', 'id', 'invoice');
