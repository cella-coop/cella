-- How each action that writes the report feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- report:report:save: the actor's report as the entry keeps it, saved on
-- the entry's day, or saved again over their own; another's keeps its
-- row, as it did when the guard refused the write.
CREATE FUNCTION report.fold_save(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO report.report (id, title, caption, definition, owner, saved)
  VALUES (fold_save.entry -> 'payload' ->> 'report', fold_save.entry -> 'payload' ->> 'title',
          coalesce(fold_save.entry -> 'payload' ->> 'caption', ''), (fold_save.entry -> 'payload' -> 'definition')::json,
          fold_save.entry ->> 'actor', (fold_save.entry ->> 'date')::date)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, caption = EXCLUDED.caption, definition = EXCLUDED.definition, saved = EXCLUDED.saved
  WHERE report.report.owner = EXCLUDED.owner;
END;

SELECT cella.lets_fold('report:report:save', 1, 'report.fold_save(jsonb)', 'report');
