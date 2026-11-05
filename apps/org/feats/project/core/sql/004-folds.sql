-- How each action that writes the project feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- project:project:create: the project under the id the entry names, in
-- its circle, with its title, summary and due day, started on the day it
-- names.
CREATE FUNCTION project.fold_create(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO project.project (id, title, circle, summary, started, due)
  VALUES (fold_create.entry -> 'payload' ->> 'project', fold_create.entry -> 'payload' ->> 'title',
          fold_create.entry -> 'payload' ->> 'circle', fold_create.entry -> 'payload' ->> 'summary',
          (fold_create.entry -> 'payload' ->> 'started')::date, (fold_create.entry -> 'payload' ->> 'due')::date);
END;

-- project:milestone:add: the milestone under the number the entry names,
-- with its title and due day; the feat's trigger puts it in its
-- project's circle, as it did when it was added.
CREATE FUNCTION project.fold_add(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO project.milestone (project, n, title, due)
  VALUES (fold_add.entry -> 'payload' ->> 'project', (fold_add.entry -> 'payload' ->> 'n')::integer,
          fold_add.entry -> 'payload' ->> 'title', (fold_add.entry -> 'payload' ->> 'due')::date);
END;

-- project:milestone:complete: the milestone, complete on the day the
-- entry names; one complete already keeps its first day.
CREATE FUNCTION project.fold_complete(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE project.milestone SET completed = coalesce(completed, (fold_complete.entry -> 'payload' ->> 'completed')::date)
  WHERE project = fold_complete.entry -> 'payload' ->> 'project' AND n = (fold_complete.entry -> 'payload' ->> 'n')::integer;
END;

-- project:project:budget: the pot set to the amount the entry names.
CREATE FUNCTION project.fold_budget(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE project.project SET budget = cella.amount((fold_budget.entry -> 'payload' ->> 'amount')::bigint)
  WHERE id = fold_budget.entry -> 'payload' ->> 'project';
END;

-- project:project:archive: the project, archived on the day the entry
-- names; archiving twice changes nothing.
CREATE FUNCTION project.fold_archive(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE project.project SET archived = (fold_archive.entry -> 'payload' ->> 'archived')::date
  WHERE id = fold_archive.entry -> 'payload' ->> 'project' AND archived IS NULL;
END;

SELECT cella.lets_fold('project:project:create', 1, 'project.fold_create(jsonb)', 'project');
SELECT cella.lets_fold('project:milestone:add', 1, 'project.fold_add(jsonb)', 'project');
SELECT cella.lets_fold('project:milestone:complete', 1, 'project.fold_complete(jsonb)', 'project');
SELECT cella.lets_fold('project:project:budget', 1, 'project.fold_budget(jsonb)', 'project');
SELECT cella.lets_fold('project:project:archive', 1, 'project.fold_archive(jsonb)', 'project');
