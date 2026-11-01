CREATE SCHEMA project_task;

-- Which project a task is in, and which of its milestones, if any. A task
-- with no row here stands alone, which is not invalid; it is in one
-- project at a time, and the last filing wins.
CREATE TABLE project_task.filing (
  task text PRIMARY KEY,
  project text NOT NULL,
  milestone integer
);

CREATE INDEX ON project_task.filing (project);

-- Both sides resolve: the task exists, its project exists and is not
-- archived, and its milestone is one of the project's.
CREATE FUNCTION project_task.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  archived date;
BEGIN
  IF NOT EXISTS (SELECT FROM task.task t WHERE t.id = NEW.task) THEN
    RAISE EXCEPTION 'no task %', NEW.task USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT p.archived INTO archived FROM project.project p WHERE p.id = NEW.project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no project %', NEW.project USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF archived IS NOT NULL THEN
    RAISE EXCEPTION '% was archived on %: it takes no tasks', NEW.project, archived USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NEW.milestone IS NOT NULL AND NOT EXISTS (
    SELECT FROM project.milestone m WHERE m.project = NEW.project AND m.n = NEW.milestone
  ) THEN
    RAISE EXCEPTION '% has no milestone %', NEW.project, NEW.milestone USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON project_task.filing
  FOR EACH ROW EXECUTE FUNCTION project_task.resolves();

-- Each project's tasks: how many, and how many are done.
CREATE VIEW project_task.count AS
SELECT f.project, count(*)::integer AS tasks, (count(*) FILTER (WHERE t.status = 'done'))::integer AS done
FROM project_task.filing f JOIN task.task t ON t.id = f.task
GROUP BY f.project;

GRANT USAGE ON SCHEMA project_task TO cella_app, cella_guards;
GRANT SELECT ON project_task.filing, project_task.count TO cella_app, cella_guards;
GRANT INSERT, UPDATE ON project_task.filing TO cella_app;
