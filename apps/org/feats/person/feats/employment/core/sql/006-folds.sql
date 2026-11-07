-- How each action that writes the employment feat's schema applies to
-- the state before it (architecture.md, "Folds").

-- employment:worker:hire: the worker and their contract as the entry
-- carries them, their name as its commitment, hired on the entry's day.
CREATE FUNCTION employment.fold_hire(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO employment.worker (address, name, job, contract, start, until, minutes, hired)
  VALUES (p ->> 'worker', cella.commits('employment.worker.name', p ->> 'worker', (entry ->> 'n')::bigint, p -> 'name'),
          p ->> 'job', p ->> 'contract', (p ->> 'start')::date, (p ->> 'until')::date, (p ->> 'minutes')::integer,
          (entry ->> 'date')::date);
END
$$;

SELECT cella.lets_fold('employment:worker:hire', 1, 'employment.fold_hire(jsonb)', 'employment');
