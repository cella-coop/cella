-- A correction keeps the books, as a post does, so it needs record-entry;
-- what it may do to a cash account is the account-transaction graft's rule.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('transaction:transaction:adjust', 'record-entry', NULL, 'transaction');
