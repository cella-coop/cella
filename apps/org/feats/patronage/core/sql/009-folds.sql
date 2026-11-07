-- How each action that writes the patronage feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- patronage:terms:adopt: the rule's values copied into terms by the SQL
-- its handler runs, `patronage.terms_from`, on the policy register as
-- the fold has it, which must make the terms the entry names.
CREATE FUNCTION patronage.fold_adopt(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  made text := patronage.terms_from(p ->> 'policy');
BEGIN
  IF made IS DISTINCT FROM nullif(p ->> 'terms', '') THEN
    RAISE EXCEPTION 'patronage: entry % adopts % from %, but its rule makes %', entry ->> 'n', p ->> 'terms', p ->> 'policy', coalesce(made, 'no terms');
  END IF;
END
$$;

-- patronage:distribution:draft: the year's split as its handler drafts
-- it, from the surplus and the percents the entry keeps: the basis of the
-- terms governing the year, and each share split from the surplus to the
-- cent.
CREATE FUNCTION patronage.fold_draft(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  kinds text[] := ARRAY['work', 'legal', 'development', 'interest'];
  percents bigint[] := ARRAY[(p ->> 'work')::bigint, (p ->> 'legal')::bigint, (p ->> 'development')::bigint, (p ->> 'interest')::bigint];
BEGIN
  INSERT INTO patronage.distribution (id, year, surplus, basis)
  VALUES (p ->> 'distribution', (p ->> 'year')::integer, cella.amount((p ->> 'surplus')::bigint),
          coalesce(patronage.basis_of(patronage.terms_for((p ->> 'year')::integer)), 'mix'))
  ON CONFLICT (year) DO UPDATE SET surplus = excluded.surplus, basis = excluded.basis;
  DELETE FROM patronage.share WHERE distribution = p ->> 'distribution';
  INSERT INTO patronage.share (distribution, kind, percent, amount)
  SELECT p ->> 'distribution', k.kind, k.hundredths / 100.0, cella.amount((cella.allocate(cella.amount((p ->> 'surplus')::bigint), percents))[k.n])
  FROM unnest(kinds, percents) WITH ORDINALITY AS k (kind, hundredths, n)
  WHERE k.hundredths > 0;
END
$$;

-- patronage:distribution:approve: the split, approved on the entry's day,
-- and the workers' parts the entry keeps, each figure as its commitment,
-- since the divisions that made them read pay and time the log keeps no
-- value of.
CREATE FUNCTION patronage.fold_approve(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  n bigint := (entry ->> 'n')::bigint;
BEGIN
  UPDATE patronage.distribution SET approved = (entry ->> 'date')::date WHERE id = p ->> 'distribution';
  INSERT INTO patronage.part (distribution, worker, basis, quantity, amount)
  SELECT p ->> 'distribution', x ->> 'worker', x ->> 'basis',
         CASE WHEN cella.commits('patronage.part.quantity', x ->> 'worker', n, x -> 'quantity') IS NOT NULL THEN NULL::bigint END,
         CASE WHEN cella.commits('patronage.part.amount', x ->> 'worker', n, x -> 'amount') IS NOT NULL THEN NULL::cella.amount END
  FROM jsonb_array_elements(p -> 'parts') x;
END
$$;

-- patronage:distribution:distribute: the split, distributed on the
-- entry's day; patronage-transaction folds the entry posting it.
CREATE FUNCTION patronage.fold_distribute(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE patronage.distribution SET distributed = (fold_distribute.entry ->> 'date')::date
  WHERE id = fold_distribute.entry -> 'payload' ->> 'distribution';
END;

SELECT cella.lets_fold('patronage:terms:adopt', 1, 'patronage.fold_adopt(jsonb)', 'patronage');
SELECT cella.lets_fold('patronage:distribution:draft', 1, 'patronage.fold_draft(jsonb)', 'patronage');
SELECT cella.lets_fold('patronage:distribution:approve', 1, 'patronage.fold_approve(jsonb)', 'patronage');
SELECT cella.lets_fold('patronage:distribution:distribute', 1, 'patronage.fold_distribute(jsonb)', 'patronage');
