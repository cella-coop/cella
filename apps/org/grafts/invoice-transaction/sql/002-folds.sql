-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds"), once the invoice feat's fold has
-- issued, paid or voided the invoice.

-- The entry an invoice's issue, payment or void posted, as its payload
-- keeps it, linked as the event it is, a payment's with the payment's
-- id. A payment that merged posted nothing, and folds nothing.
CREATE FUNCTION invoice_transaction.fold_posting(entry jsonb, event text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF p ->> 'entry' IS NULL THEN
    RETURN;
  END IF;
  IF p -> 'posting' IS NULL THEN
    RAISE EXCEPTION 'invoice-transaction: entry % keeps no posting of %''s %, so no fold rebuilds it', entry ->> 'n', p ->> 'invoice', event;
  END IF;
  PERFORM transaction.fold_record((entry ->> 'n')::bigint, p ->> 'entry', p -> 'posting');
  INSERT INTO invoice_transaction.posting (entry, invoice, event, payment)
  VALUES (p ->> 'entry', p ->> 'invoice', event, CASE WHEN event = 'payment' THEN (p ->> 'payment')::bigint END);
END
$$;

-- invoice:invoice:issue: the invoice's entry.
CREATE FUNCTION invoice_transaction.fold_issue(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT invoice_transaction.fold_posting(fold_issue.entry, 'issue');
END;

-- invoice:invoice:payment: the payment's entry.
CREATE FUNCTION invoice_transaction.fold_payment(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT invoice_transaction.fold_posting(fold_payment.entry, 'payment');
END;

-- invoice:invoice:void: the credit note.
CREATE FUNCTION invoice_transaction.fold_void(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT invoice_transaction.fold_posting(fold_void.entry, 'void');
END;

SELECT cella.lets_fold('invoice:invoice:issue', 1, 'invoice_transaction.fold_issue(jsonb)', 'invoice-transaction');
SELECT cella.lets_fold('invoice:invoice:payment', 1, 'invoice_transaction.fold_payment(jsonb)', 'invoice-transaction');
SELECT cella.lets_fold('invoice:invoice:void', 1, 'invoice_transaction.fold_void(jsonb)', 'invoice-transaction');
