-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds"), once the expense feat's fold has
-- moved the expense.

-- The entry an expense's approval or reimbursement posted, as its payload
-- keeps it, linked as the event it is.
CREATE FUNCTION expense_transaction.fold_posting(entry jsonb, event text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF p -> 'posting' IS NULL THEN
    RAISE EXCEPTION 'expense-transaction: entry % keeps no posting of %''s %, so no fold rebuilds it', entry ->> 'n', p ->> 'expense', event;
  END IF;
  PERFORM transaction.fold_record((entry ->> 'n')::bigint, p ->> 'entry', p -> 'posting');
  INSERT INTO expense_transaction.posting (entry, expense, event) VALUES (p ->> 'entry', p ->> 'expense', event);
END
$$;

-- expense:expense:approve: the charge.
CREATE FUNCTION expense_transaction.fold_approve(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT expense_transaction.fold_posting(fold_approve.entry, 'charge');
END;

-- expense:expense:reimburse: the payment.
CREATE FUNCTION expense_transaction.fold_reimburse(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT expense_transaction.fold_posting(fold_reimburse.entry, 'payment');
END;

SELECT cella.lets_fold('expense:expense:approve', 1, 'expense_transaction.fold_approve(jsonb)', 'expense-transaction');
SELECT cella.lets_fold('expense:expense:reimburse', 1, 'expense_transaction.fold_reimburse(jsonb)', 'expense-transaction');
