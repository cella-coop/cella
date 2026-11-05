CREATE SCHEMA project;

-- An initiative: what it is, the circle that runs it, when it started and
-- is due, and its budget, the pot its shares and its time are spent
-- against. A project with no budget has none set yet. `circle` names the
-- circle as text, as a motion does; an archived project is kept for the
-- books and hidden from lists.
CREATE TABLE project.project (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (title <> ''),
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  summary text NOT NULL DEFAULT '',
  started date NOT NULL,
  due date,
  budget cella.amount,
  archived date
);

-- A milestone: a phase or a deliverable, numbered within its project in
-- the order it was added, complete from the day it was completed.
CREATE TABLE project.milestone (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  project text NOT NULL REFERENCES project.project,
  n integer NOT NULL CHECK (n > 0),
  title text NOT NULL CHECK (title <> ''),
  due date,
  completed date,
  PRIMARY KEY (project, n)
);

-- An archived project is frozen: its budget and its milestones change no
-- more.
CREATE FUNCTION project.stays_archived() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.archived IS NOT NULL THEN
    RAISE EXCEPTION '% was archived on %', OLD.id, OLD.archived
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_archived BEFORE UPDATE ON project.project
  FOR EACH ROW EXECUTE FUNCTION project.stays_archived();

CREATE FUNCTION project.live() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  archived date;
BEGIN
  SELECT p.archived INTO archived FROM project.project p WHERE p.id = NEW.project;
  IF archived IS NOT NULL THEN
    RAISE EXCEPTION '% was archived on %: its milestones change no more', NEW.project, archived
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER live BEFORE INSERT OR UPDATE ON project.milestone
  FOR EACH ROW EXECUTE FUNCTION project.live();

-- A project's progress: its milestones, how many are complete, and the
-- next one open.
CREATE VIEW project.progress WITH (security_invoker = true) AS
SELECT p.id,
       count(m.n)::integer AS milestones,
       (count(m.n) FILTER (WHERE m.completed IS NOT NULL))::integer AS completed,
       (SELECT m2.title FROM project.milestone m2
        WHERE m2.project = p.id AND m2.completed IS NULL ORDER BY m2.n LIMIT 1) AS next
FROM project.project p
LEFT JOIN project.milestone m ON m.project = p.id
GROUP BY p.id;

-- project:project:budget — the write set the budget it names. Whether the
-- budget still covers what was shared from it is the membership-project
-- graft's guard on the same op.
CREATE FUNCTION project.budgets(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.id IS NULL THEN 'no project ' || coalesce(w.id, 'is named')
    WHEN cella.cents(p.budget) IS DISTINCT FROM w.cents THEN p.id || '''s budget was not set by this write'
  END
  FROM (SELECT payload ->> 'project' AS id, (payload ->> 'amount')::bigint AS cents) w
  LEFT JOIN project.project p ON p.id = w.id;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('project:project:budget', 'project.budgets(jsonb)', 'project');

GRANT USAGE ON SCHEMA project TO cella_app, cella_guards;
GRANT SELECT, INSERT, UPDATE ON project.project, project.milestone TO cella_app;
GRANT SELECT ON project.progress TO cella_app;
GRANT SELECT ON project.project, project.milestone, project.progress TO cella_guards;

-- A milestone is in its project's circle, copied as it is made.
CREATE FUNCTION project.in_its_circle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.circle := coalesce((SELECT p.circle FROM project.project p WHERE p.id = NEW.project), NEW.circle);
  RETURN NEW;
END
$$;

CREATE TRIGGER in_its_circle BEFORE INSERT ON project.milestone
  FOR EACH ROW EXECUTE FUNCTION project.in_its_circle();
