-- The power each expense write needs beyond the member's own; the
-- circle-membership graft's rule checks that the actor holds it. Approving
-- needs approve-expense within the mandate's limit for the expense's
-- amount, and within its budget for the month, which the
-- circle-expense-membership graft checks; money leaves the bank only under
-- reimburse-expense, within its limit. Capturing and submitting are the
-- member's own, by `expense.captures` and `expense.submits`.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('expense:expense:approve', 'approve-expense', 'amount', 'expense'),
  ('expense:expense:refuse', 'approve-expense', NULL, 'expense'),
  ('expense:expense:reimburse', 'reimburse-expense', 'amount', 'expense');
