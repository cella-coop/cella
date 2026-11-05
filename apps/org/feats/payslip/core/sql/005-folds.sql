-- How each action that writes the payslip feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- payslip:run:generate: the run, prepared on the entry's day, and a
-- payslip for each member its figures name, every figure as its
-- commitment, since `payslip.due` reads salaries the log keeps no value
-- of.
CREATE FUNCTION payslip.fold_generate(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  n bigint := (entry ->> 'n')::bigint;
  f jsonb;
BEGIN
  INSERT INTO payslip.run (month, generated) VALUES (p ->> 'month', (entry ->> 'date')::date);
  FOR f IN SELECT x FROM jsonb_array_elements(p -> 'figures') x LOOP
    PERFORM cella.commits('payslip.payslip.' || c, f ->> 'member', n, f -> c) FROM unnest(ARRAY['gross', 'employee', 'employer', 'net']) c;
    INSERT INTO payslip.payslip (month, member, gross, employee, employer, net) VALUES (p ->> 'month', f ->> 'member', NULL, NULL, NULL, NULL);
  END LOOP;
END
$$;

-- payslip:run:approve: the run, approved on the entry's day by its actor.
CREATE FUNCTION payslip.fold_approve(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE payslip.run SET approved = (fold_approve.entry ->> 'date')::date, approver = fold_approve.entry ->> 'actor'
  WHERE month = fold_approve.entry -> 'payload' ->> 'month';
END;

-- payslip:run:pay: the run, paid on the entry's day.
CREATE FUNCTION payslip.fold_pay(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE payslip.run SET paid = (fold_pay.entry ->> 'date')::date WHERE month = fold_pay.entry -> 'payload' ->> 'month';
END;

SELECT cella.lets_fold('payslip:run:generate', 1, 'payslip.fold_generate(jsonb)', 'payslip');
SELECT cella.lets_fold('payslip:run:approve', 1, 'payslip.fold_approve(jsonb)', 'payslip');
SELECT cella.lets_fold('payslip:run:pay', 1, 'payslip.fold_pay(jsonb)', 'payslip');
