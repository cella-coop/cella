-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds").

-- expense-project:expense:rebill: the expense the entry names, filed
-- under its project, replacing any it was under.
CREATE FUNCTION expense_project.fold_rebill(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO expense_project.rebill (expense, project)
  VALUES (fold_rebill.entry -> 'payload' ->> 'expense', fold_rebill.entry -> 'payload' ->> 'project')
  ON CONFLICT (expense) DO UPDATE SET project = excluded.project;
END;

SELECT cella.lets_fold('expense-project:expense:rebill', 1, 'expense_project.fold_rebill(jsonb)', 'expense-project');
