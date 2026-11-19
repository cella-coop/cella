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
  status text NOT NULL DEFAULT 'next' CHECK (status IN ('backlog', 'next', 'active', 'review', 'done')),
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

-- A comment on a task, under the receipt of the write that posted it: a
-- root, or a reply to a root of the same task, never to a reply, so
-- replies are flat, one level. Only a root is resolved, on its day, and a
-- new reply reopens it. Its text is its author's free text, a mention in
-- it `@[address]`; `task.mention` holds who each names. It is in its
-- task's circle, copied as it is made.
CREATE TABLE task.comment (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id bigint PRIMARY KEY,
  task text NOT NULL REFERENCES task.task,
  author text NOT NULL REFERENCES person.person,
  parent bigint,
  text text NOT NULL CHECK (btrim(text) <> ''),
  posted date NOT NULL,
  resolved date,
  UNIQUE (task, id),
  FOREIGN KEY (task, parent) REFERENCES task.comment (task, id),
  CHECK (parent < id),
  CHECK (parent IS NULL OR resolved IS NULL)
);

CREATE INDEX ON task.comment (task);

-- Each person a comment's text mentions, `n` the place of the mention in
-- it, by their address, the pseudonym every entry names them by: the
-- thread draws them by their name as it stands.
CREATE TABLE task.mention (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  comment bigint NOT NULL REFERENCES task.comment,
  n integer NOT NULL CHECK (n > 0),
  person text NOT NULL REFERENCES person.person,
  PRIMARY KEY (comment, n),
  UNIQUE (comment, person)
);

CREATE INDEX ON task.mention (person);

-- A person's reaction to a task's comment, one of core body's fixed six:
-- one row per comment, person and emoji, there while it is on, the person
-- by their address. It is in its comment's circle, copied as it is made.
CREATE TABLE task.reaction (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  comment bigint NOT NULL REFERENCES task.comment,
  person text NOT NULL REFERENCES person.person,
  emoji text NOT NULL CHECK (emoji IN ('👍', '❤️', '😄', '🎉', '👀', '🙏')),
  PRIMARY KEY (comment, person, emoji)
);

CREATE FUNCTION task.in_its_circle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'comment' THEN
    NEW.circle := coalesce((SELECT t.circle FROM task.task t WHERE t.id = NEW.task), NEW.circle);
  ELSE
    NEW.circle := coalesce((SELECT c.circle FROM task.comment c WHERE c.id = NEW.comment), NEW.circle);
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER in_its_circle BEFORE INSERT ON task.comment
  FOR EACH ROW EXECUTE FUNCTION task.in_its_circle();

CREATE TRIGGER in_its_circle BEFORE INSERT ON task.mention
  FOR EACH ROW EXECUTE FUNCTION task.in_its_circle();

CREATE TRIGGER in_its_circle BEFORE INSERT ON task.reaction
  FOR EACH ROW EXECUTE FUNCTION task.in_its_circle();

GRANT SELECT, INSERT ON task.comment, task.mention TO cella_app;
GRANT UPDATE (resolved) ON task.comment TO cella_app;
GRANT SELECT, INSERT, DELETE ON task.reaction TO cella_app;
GRANT SELECT ON task.comment, task.mention, task.reaction TO cella_guards;
