-- Posting needs record-entry, with no limit: keeping the books is a duty,
-- and what an entry may move out of the bank is capped by the writes that
-- name it, such as pay.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('transaction:transaction:post', 'record-entry', NULL, 'transaction');
