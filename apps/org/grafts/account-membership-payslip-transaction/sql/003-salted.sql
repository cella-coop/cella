-- The cents of each instalment are personal data of their member, of
-- class `books`: a spread's payload commits to them, and the vault keeps
-- them, so the log's digest confirms no guess at what a colleague owes.
-- Once a former member's clock runs out the sweep redacts them to NULL, so
-- they are nullable.
ALTER TABLE account_membership_payslip_transaction.plan ALTER COLUMN each DROP NOT NULL;

INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('account_membership_payslip_transaction', 'plan', 'each', 'books', 'member', 'account-membership-payslip-transaction');
