-- How each action that writes the import feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- import:run:record: the run under the id the entry names, of its kind
-- and its file's name, recorded by the entry's actor on its day, with its
-- counts and each of its lines as the entry keeps them; the table checks
-- the counts add up to the lines, as it did.
CREATE FUNCTION import.fold_record(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO import.run (id, kind, name, actor, day, dry, settled, refused, lines)
  VALUES (fold_record.entry -> 'payload' ->> 'run', fold_record.entry -> 'payload' ->> 'kind',
          fold_record.entry -> 'payload' ->> 'name', fold_record.entry ->> 'actor', (fold_record.entry ->> 'date')::date,
          (fold_record.entry -> 'payload' ->> 'dry')::boolean, (fold_record.entry -> 'payload' ->> 'settled')::integer,
          (fold_record.entry -> 'payload' ->> 'refused')::integer, fold_record.entry -> 'payload' -> 'lines');
END;

SELECT cella.lets_fold('import:run:record', 1, 'import.fold_record(jsonb)', 'import');
