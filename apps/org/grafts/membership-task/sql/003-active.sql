-- An assignee is an active member as membership says one is, on the
-- verdict date (`membership.active`), not by a copy of its status.
CREATE OR REPLACE FUNCTION membership_task.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM task.task t WHERE t.id = NEW.task) THEN
    RAISE EXCEPTION 'no task %', NEW.task USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT membership.active(NEW.member, cella.verdict_date()) THEN
    RAISE EXCEPTION '% is no active member: a task goes to one', NEW.member USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;
