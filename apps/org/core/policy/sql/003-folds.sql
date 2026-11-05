-- The policy register changes only by `policy.adopt` and `policy.end`,
-- which the motion feat's handlers call, and its folds again
-- (architecture.md, "Folds"): what each of policy's own folds adds is a
-- check that the register holds what the entry says, after them.

-- motion:policy:adopt: the policy its entry adopted is in the register,
-- with its hash; one that adopted none adds none.
CREATE FUNCTION policy.fold_adopted(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF nullif(p ->> 'policy', '') IS NOT NULL
     AND NOT EXISTS (SELECT FROM policy.policy x WHERE x.id = p ->> 'policy' AND encode(x.hash, 'hex') = p ->> 'hash') THEN
    RAISE EXCEPTION 'policy: entry % adopts %, which the folded register does not hold as it hashed it', entry ->> 'n', p ->> 'policy';
  END IF;
END
$$;

-- motion:policy:end: the policy its entry ended ends on the day it says.
CREATE FUNCTION policy.fold_ended(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF nullif(p ->> 'policy', '') IS NOT NULL
     AND NOT EXISTS (SELECT FROM policy.policy x WHERE x.id = p ->> 'policy' AND x.ends = (p ->> 'ends')::date) THEN
    RAISE EXCEPTION 'policy: entry % ends % on %, which the folded register does not', entry ->> 'n', p ->> 'policy', p ->> 'ends';
  END IF;
END
$$;

SELECT cella.lets_fold('motion:policy:adopt', 1, 'policy.fold_adopted(jsonb)', 'policy');
SELECT cella.lets_fold('motion:policy:end', 1, 'policy.fold_ended(jsonb)', 'policy');
