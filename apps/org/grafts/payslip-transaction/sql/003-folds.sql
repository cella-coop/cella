-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds"), once the payslip feat's fold has
-- moved the run.

-- The entry a run's approval or payment posted, as its payload keeps it,
-- linked as the event it is. What a graft above kept of a payment's
-- lines, by `keep`, its own fold of the payment rebuilds.
CREATE FUNCTION payslip_transaction.fold_posting(entry jsonb, event text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF p -> 'posting' IS NULL THEN
    RAISE EXCEPTION 'payslip-transaction: entry % keeps no posting of %''s %, so no fold rebuilds it', entry ->> 'n', p ->> 'month', event;
  END IF;
  PERFORM transaction.fold_record((entry ->> 'n')::bigint, p ->> 'entry', p -> 'posting');
  INSERT INTO payslip_transaction.posting (entry, month, event) VALUES (p ->> 'entry', p ->> 'month', event);
END
$$;

-- payslip:run:approve: the accrual.
CREATE FUNCTION payslip_transaction.fold_approve(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT payslip_transaction.fold_posting(fold_approve.entry, 'accrual');
END;

-- payslip:run:pay: the payment.
CREATE FUNCTION payslip_transaction.fold_pay(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT payslip_transaction.fold_posting(fold_pay.entry, 'payment');
END;

SELECT cella.lets_fold('payslip:run:approve', 1, 'payslip_transaction.fold_approve(jsonb)', 'payslip-transaction');
SELECT cella.lets_fold('payslip:run:pay', 1, 'payslip_transaction.fold_pay(jsonb)', 'payslip-transaction');
