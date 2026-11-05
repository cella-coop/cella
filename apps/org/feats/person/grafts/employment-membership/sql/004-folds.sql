-- How each action that writes the employment-membership graft's schema
-- applies to the state before it (architecture.md, "Folds").

-- employment-membership:candidacy:open: the candidacy as its entry
-- carries it, opened on the entry's day.
CREATE FUNCTION employment_membership.fold_open(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened)
  VALUES (p ->> 'worker', (p ->> 'from')::date, (p ->> 'to')::date, (p ->> 'shares')::integer, (entry ->> 'date')::date);
END
$$;

SELECT cella.lets_fold('employment-membership:candidacy:open', 1, 'employment_membership.fold_open(jsonb)', 'employment-membership');
