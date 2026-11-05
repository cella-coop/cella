-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds"), a creation once the task feat's
-- fold has made the task.

-- project-task:task:file: the task filed under the project and the
-- milestone the entry names; filed already, it moves.
CREATE FUNCTION project_task.fold_file(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO project_task.filing (task, project, milestone)
  VALUES (fold_file.entry -> 'payload' ->> 'task', fold_file.entry -> 'payload' ->> 'project',
          (fold_file.entry -> 'payload' ->> 'milestone')::integer)
  ON CONFLICT (task) DO UPDATE SET project = excluded.project, milestone = excluded.milestone;
END;

-- task:task:create: a task made already in a project, filed under the
-- project and the milestone the entry names; one made in none writes
-- nothing here.
CREATE FUNCTION project_task.fold_create(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO project_task.filing (task, project, milestone)
  SELECT fold_create.entry -> 'payload' ->> 'task', fold_create.entry -> 'payload' ->> 'project',
         (fold_create.entry -> 'payload' ->> 'milestone')::integer
  WHERE fold_create.entry -> 'payload' ->> 'project' IS NOT NULL;
END;

SELECT cella.lets_fold('project-task:task:file', 1, 'project_task.fold_file(jsonb)', 'project-task');
SELECT cella.lets_fold('task:task:create', 1, 'project_task.fold_create(jsonb)', 'project-task');
