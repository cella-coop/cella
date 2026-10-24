CREATE SCHEMA member_task;

-- Who does a task. A task with no row here is unassigned, not invalid; a
-- task has one assignee, and the last assignment wins.
CREATE TABLE member_task.assignment (
  task text PRIMARY KEY,
  member text NOT NULL
);

CREATE INDEX ON member_task.assignment (member);

-- Both sides resolve: the task exists, and its assignee is an active
-- member.
CREATE FUNCTION member_task.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM task.task t WHERE t.id = NEW.task) THEN
    RAISE EXCEPTION 'no task %', NEW.task USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM member.member m WHERE m.address = NEW.member AND m.status = 'active') THEN
    RAISE EXCEPTION '% is no active member: a task goes to one', NEW.member USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON member_task.assignment
  FOR EACH ROW EXECUTE FUNCTION member_task.resolves();

GRANT USAGE ON SCHEMA member_task TO cella_app, cella_rules;
GRANT SELECT ON member_task.assignment TO cella_app, cella_rules;
GRANT INSERT, UPDATE, DELETE ON member_task.assignment TO cella_app;
