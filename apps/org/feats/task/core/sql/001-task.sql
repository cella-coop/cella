CREATE SCHEMA task;

CREATE SEQUENCE task.number;

-- A work item. Each field is its own register: a move sets the status, a
-- completion sets it done with its day, and the last write to a field
-- wins it. Who does it and what project it is in are the membership-task and
-- project-task grafts'. Its body is its free-form content, a Loro snapshot
-- of core body's blocks, set by each save an editor's browser signs, and
-- always one with a canonical form.
CREATE TABLE task.task (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY DEFAULT 't-' || nextval('task.number'),
  title text NOT NULL CHECK (title <> ''),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'doing', 'done')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  due date,
  created date NOT NULL,
  completed date,
  body bytea CHECK (body IS NULL OR cella.document_canonical(body) IS NOT NULL),
  CHECK ((status = 'done') = (completed IS NOT NULL))
);

GRANT USAGE ON SCHEMA task TO cella_app, cella_guards;
GRANT SELECT, INSERT, UPDATE ON task.task TO cella_app;
GRANT USAGE ON SEQUENCE task.number TO cella_app;
GRANT SELECT ON task.task TO cella_guards;
