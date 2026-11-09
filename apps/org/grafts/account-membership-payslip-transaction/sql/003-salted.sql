-- The cents of each instalment are personal data of their member, of
-- class `books`: a spread's payload commits to them, and the payment's
-- that withholds one to what it withheld, and the vault keeps them, so
-- the log's digest confirms no guess at what a colleague owes. Once a
-- former member's clock runs out the sweep redacts them to NULL, so they
-- are nullable.
ALTER TABLE account_membership_payslip_transaction.plan ALTER COLUMN each DROP NOT NULL;
ALTER TABLE account_membership_payslip_transaction.withheld ALTER COLUMN amount DROP NOT NULL;

INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('account_membership_payslip_transaction', 'plan', 'each', 'books', 'member', 'account-membership-payslip-transaction'),
  ('account_membership_payslip_transaction', 'withheld', 'amount', 'books', 'member', 'account-membership-payslip-transaction');
