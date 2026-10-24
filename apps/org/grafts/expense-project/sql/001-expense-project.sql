CREATE SCHEMA expense_project;

-- The project an expense was spent for, to be billed on to its client.
-- Both sides are referenced by id, with no foreign key into either feat;
-- an expense under no project is the co-op's own.
CREATE TABLE expense_project.rebill (
  expense text PRIMARY KEY,
  project text NOT NULL
);

CREATE INDEX ON expense_project.rebill (project);

-- expense-project:expense:rebill — the member files their own expense
-- under a live project, while it is not yet reimbursed or refused.
CREATE FUNCTION expense_project.files(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no expense ' || coalesce(x.expense, 'is named')
    WHEN e.member IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may not file ' || e.member || '''s expense'
    WHEN e.status IN ('refused', 'reimbursed') THEN e.id || ' is ' || e.status
    WHEN p.id IS NULL THEN 'no project ' || coalesce(x.project, 'is named')
    WHEN p.archived IS NOT NULL THEN p.id || ' was archived on ' || p.archived::text
  END
  FROM (SELECT payload ->> 'expense' AS expense, payload ->> 'project' AS project) x
  LEFT JOIN expense.expense e ON e.id = x.expense
  LEFT JOIN project.project p ON p.id = x.project;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('expense-project:expense:rebill', 'expense_project.files(jsonb)', 'expense-project');

-- What each project's members spent for it, to bill on, by status.
CREATE VIEW expense_project.spent AS
SELECT r.project, count(*)::integer AS expenses,
       coalesce(sum(expense.total(e)) FILTER (WHERE e.status IN ('approved', 'reimbursed')), 0) AS approved,
       coalesce(sum(expense.total(e)) FILTER (WHERE e.status IN ('draft', 'submitted')), 0) AS pending
FROM expense_project.rebill r
JOIN expense.expense e ON e.id = r.expense
GROUP BY r.project;

GRANT USAGE ON SCHEMA expense_project TO cella_app, cella_rules;
GRANT SELECT ON expense_project.rebill, expense_project.spent TO cella_app, cella_rules;
GRANT INSERT, UPDATE ON expense_project.rebill TO cella_app;
