-- How each action of membership-motion applies to the state before it
-- (architecture.md, "Folds").

-- membership-motion:scope:found: the founding carries the state the
-- coop held before its log, every state table's rows, which
-- `cella.fold_log` applies before this fold runs; a founding that
-- carries none folds by refusing, never by founding an empty scope.
CREATE FUNCTION membership_motion.fold_found(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF entry -> 'payload' -> 'carried' IS NULL THEN
    RAISE EXCEPTION 'membership-motion: the founding, entry %, carries no rows, so no fold rebuilds the state it held', entry ->> 'n';
  END IF;
END
$$;

SELECT cella.lets_fold('membership-motion:scope:found', 1, 'membership_motion.fold_found(jsonb)', 'membership-motion');

-- membership:member:apply: the motion the application proposes in the same
-- write, once the membership feat's fold has the applicant: the motion
-- feat's `motion.fold_proposal` from the proposal the entry carries, its
-- proposer the entry's actor, which fixes its roll as a proposal's fold
-- does.
CREATE FUNCTION membership_motion.fold_apply(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM motion.fold_proposal((entry ->> 'n')::bigint, entry ->> 'actor', (entry ->> 'date')::date, entry -> 'payload');
END
$$;

SELECT cella.lets_fold('membership:member:apply', 1, 'membership_motion.fold_apply(jsonb)', 'membership-motion');
