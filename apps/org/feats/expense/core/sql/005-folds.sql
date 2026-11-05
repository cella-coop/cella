-- How each action that writes the expense feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- expense:expense:capture: the draft under the id the entry names, in its
-- circle, its figures as the entry keeps them, its label and receipt as
-- their commitments. Its total must be the entry's.
CREATE FUNCTION expense.fold_capture(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  n bigint := (entry ->> 'n')::bigint;
  made bigint;
BEGIN
  INSERT INTO expense.expense AS e (circle, id, member, day, label, category, net, vat, receipt)
  VALUES (p ->> 'circle', p ->> 'expense', p ->> 'member', (p ->> 'day')::date,
          cella.commits('expense.expense.label', p ->> 'member', n, p -> 'label'), p ->> 'category',
          cella.amount((p ->> 'net')::bigint), cella.amount((p ->> 'vat')::bigint),
          cella.commits('expense.expense.receipt', p ->> 'member', n, p -> 'receipt'))
  RETURNING expense.total(e) INTO made;
  IF made IS DISTINCT FROM (p ->> 'amount')::bigint THEN
    RAISE EXCEPTION 'expense: entry % claims % for % cents, but its figures come to %', n, p ->> 'expense', p ->> 'amount', made;
  END IF;
END
$$;

-- expense:expense:submit: the draft, submitted on the entry's day.
CREATE FUNCTION expense.fold_submit(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE expense.expense SET status = 'submitted', submitted = (fold_submit.entry ->> 'date')::date
  WHERE id = fold_submit.entry -> 'payload' ->> 'expense';
END;

-- expense:expense:approve: the expense, approved on the entry's day by its
-- actor.
CREATE FUNCTION expense.fold_approve(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE expense.expense SET status = 'approved', decided = (fold_approve.entry ->> 'date')::date, decider = fold_approve.entry ->> 'actor'
  WHERE id = fold_approve.entry -> 'payload' ->> 'expense';
END;

-- expense:expense:refuse: the expense, refused on the entry's day by its
-- actor.
CREATE FUNCTION expense.fold_refuse(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE expense.expense SET status = 'refused', decided = (fold_refuse.entry ->> 'date')::date, decider = fold_refuse.entry ->> 'actor'
  WHERE id = fold_refuse.entry -> 'payload' ->> 'expense';
END;

-- expense:expense:reimburse: the expense, reimbursed on the entry's day.
CREATE FUNCTION expense.fold_reimburse(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE expense.expense SET status = 'reimbursed', reimbursed = (fold_reimburse.entry ->> 'date')::date
  WHERE id = fold_reimburse.entry -> 'payload' ->> 'expense';
END;

SELECT cella.lets_fold('expense:expense:capture', 1, 'expense.fold_capture(jsonb)', 'expense');
SELECT cella.lets_fold('expense:expense:submit', 1, 'expense.fold_submit(jsonb)', 'expense');
SELECT cella.lets_fold('expense:expense:approve', 1, 'expense.fold_approve(jsonb)', 'expense');
SELECT cella.lets_fold('expense:expense:refuse', 1, 'expense.fold_refuse(jsonb)', 'expense');
SELECT cella.lets_fold('expense:expense:reimburse', 1, 'expense.fold_reimburse(jsonb)', 'expense');
