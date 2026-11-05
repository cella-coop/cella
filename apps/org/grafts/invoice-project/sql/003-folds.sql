-- How each action that writes the invoice-project graft's schema applies
-- to the state before it (architecture.md, "Folds").

-- invoice-project:invoice:link: the invoice charged to the project the
-- entry names; naming another moves it, as its handler does.
CREATE FUNCTION invoice_project.fold_link(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO invoice_project.charge (invoice, project)
  VALUES (fold_link.entry -> 'payload' ->> 'invoice', fold_link.entry -> 'payload' ->> 'project')
  ON CONFLICT (invoice) DO UPDATE SET project = excluded.project;
END;

SELECT cella.lets_fold('invoice-project:invoice:link', 1, 'invoice_project.fold_link(jsonb)', 'invoice-project');
