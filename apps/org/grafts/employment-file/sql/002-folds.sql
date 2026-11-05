-- How each action of employment-file applies to the state before it
-- (architecture.md, "Folds").

-- employment-file:worker:attach: the record stored about the worker by
-- the file feat's fold of the write its handler called, `storing`, as
-- its entry keeps it, then kept on the worker's file.
CREATE FUNCTION employment_file.fold_attach(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM file.fold_storing((entry ->> 'n')::bigint, entry ->> 'actor', (entry ->> 'date')::date, p);
  INSERT INTO employment_file.record (worker, file) VALUES (p ->> 'worker', p ->> 'file');
END
$$;

SELECT cella.lets_fold('employment-file:worker:attach', 1, 'employment_file.fold_attach(jsonb)', 'employment-file');
