-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds"), once the bill feat's fold has
-- moved the bill.

-- The entry a bill's approval or payment posted, as its payload keeps it,
-- linked as the event it is.
CREATE FUNCTION bill_transaction.fold_posting(entry jsonb, event text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF p -> 'posting' IS NULL THEN
    RAISE EXCEPTION 'bill-transaction: entry % keeps no posting of %''s %, so no fold rebuilds it', entry ->> 'n', p ->> 'bill', event;
  END IF;
  PERFORM transaction.fold_record((entry ->> 'n')::bigint, p ->> 'entry', p -> 'posting');
  INSERT INTO bill_transaction.posting (entry, bill, event) VALUES (p ->> 'entry', p ->> 'bill', event);
END
$$;

-- bill:bill:approve: the charge.
CREATE FUNCTION bill_transaction.fold_approve(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT bill_transaction.fold_posting(fold_approve.entry, 'charge');
END;

-- bill:bill:pay: the payment.
CREATE FUNCTION bill_transaction.fold_pay(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT bill_transaction.fold_posting(fold_pay.entry, 'payment');
END;

SELECT cella.lets_fold('bill:bill:approve', 1, 'bill_transaction.fold_approve(jsonb)', 'bill-transaction');
SELECT cella.lets_fold('bill:bill:pay', 1, 'bill_transaction.fold_pay(jsonb)', 'bill-transaction');
