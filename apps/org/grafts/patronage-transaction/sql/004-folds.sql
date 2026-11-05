-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds"), once the patronage feat's fold
-- has distributed the split.

-- patronage:distribution:distribute: the entry posting the split, as its
-- payload keeps it, linked to the distribution.
CREATE FUNCTION patronage_transaction.fold_distribute(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF p -> 'posting' IS NULL THEN
    RAISE EXCEPTION 'patronage-transaction: entry % keeps no posting of %, so no fold rebuilds it', entry ->> 'n', p ->> 'distribution';
  END IF;
  PERFORM transaction.fold_record((entry ->> 'n')::bigint, p ->> 'entry', p -> 'posting');
  INSERT INTO patronage_transaction.distribution (distribution, entry) VALUES (p ->> 'distribution', p ->> 'entry');
END
$$;

SELECT cella.lets_fold('patronage:distribution:distribute', 1, 'patronage_transaction.fold_distribute(jsonb)', 'patronage-transaction');
