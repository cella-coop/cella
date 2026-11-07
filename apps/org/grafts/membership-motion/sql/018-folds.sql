-- How each action of membership-motion applies to the state before it
-- (architecture.md, "Folds").

-- membership-motion:scope:found: the founding carries the state the
-- co-op held before its log, every state table's rows, which
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

-- motion:motion:close: the close counts the motion's roll, as its handler
-- does once the motion feat's fold has closed it (`membership_motion.count`).
CREATE FUNCTION membership_motion.fold_close(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM membership_motion.count(entry -> 'payload' ->> 'motion');
END
$$;

SELECT cella.lets_fold('motion:motion:close', 1, 'membership_motion.fold_close(jsonb)', 'membership-motion');
