-- The power each expense write needs; the
-- membership feat's guard checks that the actor holds it. Approving
-- needs approve-expense within the mandate's limit for the expense's
-- amount, and within its budget for the month, which the
-- expense-membership graft checks; money leaves the bank only under
-- reimburse-expense, within its limit. Capturing and submitting a claim
-- are every employee's right, `claim-expense`, and the claim their own,
-- by `expense.captures` and `expense.submits`.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('expense:expense:approve', 'approve-expense', 'amount', 'expense'),
  ('expense:expense:refuse', 'approve-expense', NULL, 'expense'),
  ('expense:expense:reimburse', 'reimburse-expense', 'amount', 'expense'),
  ('expense:expense:capture', 'claim-expense', NULL, 'expense'),
  ('expense:expense:submit', 'claim-expense', NULL, 'expense');
