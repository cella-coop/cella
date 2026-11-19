-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds"), once the timesheet feat's fold
-- has logged the entry.

-- timesheet:entry:log: the entry booked to the project its entry names,
-- where it names one; an entry logged without one is the coop's own
-- time. The graft's trigger judges the project again, as it did when the
-- entry was booked.
CREATE FUNCTION project_timesheet.fold_log(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO project_timesheet.booking (entry, project)
  SELECT (fold_log.entry -> 'payload' ->> 'entry')::bigint, fold_log.entry -> 'payload' ->> 'project'
  WHERE fold_log.entry -> 'payload' ->> 'project' IS NOT NULL;
END;

SELECT cella.lets_fold('timesheet:entry:log', 1, 'project_timesheet.fold_log(jsonb)', 'project-timesheet');
