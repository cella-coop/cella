-- How the writes on which motion-patronage's state changes apply to the
-- state before them (architecture.md, "Folds"). What a motion asks to
-- approve is its action, which the motion feat's fold writes, and this
-- graft's `approval` reads it, so its fold writes nothing.

-- motion:motion:propose: each action to approve a distribution the folded
-- motion carries names a draft not yet approved, as
-- `motion_patronage.asks_to_approve` judged it when it was proposed; a
-- fold that finds otherwise refuses, saying what it found.
CREATE FUNCTION motion_patronage.fold_propose(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  flaw text := motion_patronage.asks_to_approve(entry -> 'payload');
BEGIN
  IF flaw IS NOT NULL THEN
    RAISE EXCEPTION 'motion-patronage: entry % proposes %, where the fold finds %', entry ->> 'n', entry -> 'payload' ->> 'motion', flaw;
  END IF;
END
$$;

SELECT cella.lets_fold('motion:motion:propose', 1, 'motion_patronage.fold_propose(jsonb)', 'motion-patronage');
