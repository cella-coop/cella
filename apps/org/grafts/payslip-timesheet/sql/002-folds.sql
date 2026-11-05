-- How each action that writes this graft's slices applies to the state
-- before it (architecture.md, "Folds"), once the payslip feat's fold has
-- prepared the run.

-- payslip:run:generate: the minutes each payslip was worked, as the entry
-- keeps them, their commitments, since a folded scope's time entries hold
-- none of the minutes they commit to; the payslip feat's column stays as
-- erasure leaves it.
CREATE FUNCTION payslip_timesheet.fold_generate(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM cella.commits('payslip.payslip.minutes', t ->> 'member', (entry ->> 'n')::bigint, t -> 'minutes')
  FROM jsonb_array_elements(entry -> 'payload' -> 'timed') t;
END
$$;

SELECT cella.lets_fold('payslip:run:generate', 1, 'payslip_timesheet.fold_generate(jsonb)', 'payslip-timesheet');
