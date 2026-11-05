-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds"): the receipt its entry stored, by
-- the file feat's fold of `storing`, as its handler stored it, then
-- attached.

-- The receipt entry `entry` stored about its actor, as its payload keeps
-- it, its name and its BLAKE3 as their commitments, attached to the
-- expense it names.
CREATE FUNCTION expense_file.fold_receipt(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM file.fold_storing((entry ->> 'n')::bigint, entry ->> 'actor', (entry ->> 'date')::date, p);
  INSERT INTO expense_file.receipt (expense, file) VALUES (p ->> 'expense', p ->> 'file');
END
$$;

-- expense:expense:capture: a claim carrying its receipt; one without one
-- attaches nothing.
CREATE FUNCTION expense_file.fold_capture(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF entry -> 'payload' ->> 'file' IS NOT NULL THEN
    PERFORM expense_file.fold_receipt(entry);
  END IF;
END
$$;

-- expense-file:expense:attach: a receipt attached to an expense already
-- claimed.
CREATE FUNCTION expense_file.fold_attach(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT expense_file.fold_receipt(fold_attach.entry);
END;

SELECT cella.lets_fold('expense:expense:capture', 1, 'expense_file.fold_capture(jsonb)', 'expense-file');
SELECT cella.lets_fold('expense-file:expense:attach', 1, 'expense_file.fold_attach(jsonb)', 'expense-file');
