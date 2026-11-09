-- The shares a member's part of the work share buys, and their amount,
-- are personal data of theirs, of class `books`, as their payments in
-- are: the employ's payload commits to them, and the vault keeps them.
-- Once a former member's clock runs out the sweep redacts them to NULL,
-- so they are nullable.
ALTER TABLE account_membership_patronage_transaction.credit ALTER COLUMN shares DROP NOT NULL;
ALTER TABLE account_membership_patronage_transaction.credit ALTER COLUMN amount DROP NOT NULL;

INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('account_membership_patronage_transaction', 'credit', 'shares', 'books', 'member', 'account-membership-patronage-transaction'),
  ('account_membership_patronage_transaction', 'credit', 'amount', 'books', 'member', 'account-membership-patronage-transaction');
