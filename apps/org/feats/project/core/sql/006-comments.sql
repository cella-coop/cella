-- project's threads, written by `cella scaffold comments project`.
--
-- A comment on a project, under the receipt of the write that posted it: a
-- root, or a reply to a root of the same project, never to a reply, so
-- replies are flat, one level. Only a root is resolved, on its day, and a
-- new reply reopens it. Its text is its author's free text, a mention in
-- it `@[address]`; `project.mention` holds who each names. It is in its
-- project's circle, copied as it is made.
CREATE TABLE project.comment (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id bigint PRIMARY KEY,
  project text NOT NULL REFERENCES project.project,
  author text NOT NULL REFERENCES person.person,
  parent bigint,
  text text NOT NULL CHECK (btrim(text) <> ''),
  posted date NOT NULL,
  resolved date,
  UNIQUE (project, id),
  FOREIGN KEY (project, parent) REFERENCES project.comment (project, id),
  CHECK (parent < id),
  CHECK (parent IS NULL OR resolved IS NULL)
);

CREATE INDEX ON project.comment (project);

-- Each person a comment's text mentions, `n` the place of the mention in
-- it, by their address, the pseudonym every entry names them by: the
-- thread draws them by their name as it stands.
CREATE TABLE project.mention (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  comment bigint NOT NULL REFERENCES project.comment,
  n integer NOT NULL CHECK (n > 0),
  person text NOT NULL REFERENCES person.person,
  PRIMARY KEY (comment, n),
  UNIQUE (comment, person)
);

CREATE INDEX ON project.mention (person);

-- A person's reaction to a comment, one of core body's fixed six: one row
-- per comment, person and emoji, there while it is on, the person by
-- their address. It is in its comment's circle, copied as it is made.
CREATE TABLE project.reaction (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  comment bigint NOT NULL REFERENCES project.comment,
  person text NOT NULL REFERENCES person.person,
  emoji text NOT NULL CHECK (emoji IN ('👍', '❤️', '😄', '🎉', '👀', '🙏')),
  PRIMARY KEY (comment, person, emoji)
);

CREATE FUNCTION project.in_its_thread() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'comment' THEN
    NEW.circle := coalesce((SELECT t.circle FROM project.project t WHERE t.id = NEW.project), NEW.circle);
  ELSE
    NEW.circle := coalesce((SELECT c.circle FROM project.comment c WHERE c.id = NEW.comment), NEW.circle);
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER in_its_thread BEFORE INSERT ON project.comment
  FOR EACH ROW EXECUTE FUNCTION project.in_its_thread();

CREATE TRIGGER in_its_thread BEFORE INSERT ON project.mention
  FOR EACH ROW EXECUTE FUNCTION project.in_its_thread();

CREATE TRIGGER in_its_thread BEFORE INSERT ON project.reaction
  FOR EACH ROW EXECUTE FUNCTION project.in_its_thread();

GRANT SELECT, INSERT ON project.comment, project.mention TO cella_app;
GRANT UPDATE (resolved) ON project.comment TO cella_app;
GRANT SELECT, INSERT, DELETE ON project.reaction TO cella_app;
GRANT SELECT ON project.comment, project.mention, project.reaction TO cella_guards;

-- Posting, resolving and reacting need `discuss` in the project's circle,
-- which every seat there holds.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('project:comment:post', 'discuss', NULL, 'project'),
  ('project:comment:resolve', 'discuss', NULL, 'project'),
  ('project:comment:react', 'discuss', NULL, 'project');

-- project:comment:post: the comment is the actor's own, and is what its
-- payload names: its project, its parent, its text and its mentions, each in
-- the order its text gives them. A reply answers a root: a reply to a
-- reply is refused, naming the root to reply to, as is a mention of no
-- one the co-op knows. That the actor may discuss in the project's circle is
-- the power's guard's, over the circle the payload names.
CREATE FUNCTION project.posts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no comment ' || coalesce(p.comment, 'is named')
    WHEN r.parent IS NOT NULL THEN 'comment ' || r.id || ' is a reply: reply to its root, comment ' || r.parent
    WHEN u.person IS NOT NULL THEN '@[' || u.person || '] names no one the co-op knows: mention someone the picker offers'
    WHEN c.author IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not post as ' || c.author
    WHEN c.project IS DISTINCT FROM p.project
      OR c.parent IS DISTINCT FROM p.parent
      OR c.text IS DISTINCT FROM p.text
      OR ARRAY(SELECT m.person FROM project.mention m WHERE m.comment = c.id ORDER BY m.n)
         IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(coalesce(p.mentions, '[]')))
      THEN 'comment ' || c.id || ' was posted otherwise than its payload names'
  END
  FROM (
    SELECT payload ->> 'comment' AS comment, payload ->> 'project' AS project, (payload ->> 'parent')::bigint AS parent,
           payload ->> 'text' AS text, payload -> 'mentions' AS mentions
  ) p
  LEFT JOIN project.comment c ON c.id::text = p.comment
  LEFT JOIN project.comment r ON r.id = c.parent
  LEFT JOIN LATERAL (
    SELECT x.person FROM jsonb_array_elements_text(coalesce(p.mentions, '[]')) AS x (person)
    WHERE NOT EXISTS (SELECT FROM person.person q WHERE q.address = x.person)
    LIMIT 1
  ) u ON true;
END;

-- project:comment:resolve: only a root is resolved or reopened; resolving a
-- reply is refused, naming its root.
CREATE FUNCTION project.resolves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no comment ' || coalesce(p.comment, 'is named')
    WHEN c.parent IS NOT NULL THEN 'comment ' || c.id || ' is a reply: resolve its root, comment ' || c.parent
  END
  FROM (SELECT payload ->> 'comment' AS comment) p
  LEFT JOIN project.comment c ON c.id::text = p.comment;
END;

-- project:comment:react: a reaction is one of core body's fixed six, to a
-- comment there is, and is what its payload names, the actor's own on or
-- off; it is refused where the comment's circle has `reactions` off
-- (`circle.setting_of`), naming the circle and the rule that turned them
-- off and what would turn them on. That the actor may discuss in the
-- project's circle is the power's guard's.
CREATE FUNCTION project.reacts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no comment ' || coalesce(p.comment, 'is named')
    WHEN p.emoji IS NULL OR p.emoji NOT IN ('👍', '❤️', '😄', '🎉', '👀', '🙏')
      THEN coalesce(p.emoji, 'nothing') || ' is no reaction: react with one of 👍 ❤️ 😄 🎉 👀 🙏'
    WHEN circle.setting_of(c.circle, 'reactions') = 'off'
      THEN 'reactions are off in ' || c.circle || coalesce(', by rule ' || s.policy || CASE s.set_by WHEN 'assembly' THEN ' of the assembly' ELSE '' END, '')
        || ': a rule turning them on, adopted by motion, lets a comment take them'
    WHEN p.turned IS NULL THEN 'a reaction is on or off'
    WHEN p.turned <> EXISTS (SELECT FROM project.reaction r WHERE r.comment = c.id AND r.person = cella.actor() AND r.emoji = p.emoji)
      THEN 'the reaction to comment ' || c.id || ' is not ' || CASE WHEN p.turned THEN 'on' ELSE 'off' END || ' as its payload names'
  END
  FROM (SELECT payload ->> 'comment' AS comment, payload ->> 'emoji' AS emoji, (payload ->> 'on')::boolean AS turned) p
  LEFT JOIN project.comment c ON c.id::text = p.comment
  LEFT JOIN LATERAL (SELECT x.policy, x.set_by FROM circle.settings(c.circle) x WHERE x.name = 'reactions') s ON true;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('project:comment:post', 'project.posts(jsonb)', 'project'),
  ('project:comment:resolve', 'project.resolves(jsonb)', 'project'),
  ('project:comment:react', 'project.reacts(jsonb)', 'project');

-- project:comment:post: the comment under the receipt its entry names, by
-- its actor on its day, in its project's circle, and each mention its entry
-- names in order; a reply reopens its root.
CREATE FUNCTION project.fold_comment_post(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO project.comment (id, project, author, parent, text, posted)
  VALUES ((p ->> 'comment')::bigint, p ->> 'project', entry ->> 'actor', (p ->> 'parent')::bigint, p ->> 'text', (entry ->> 'date')::date);
  INSERT INTO project.mention (comment, n, person)
  SELECT (p ->> 'comment')::bigint, m.n, m.person
  FROM jsonb_array_elements_text(coalesce(p -> 'mentions', '[]')) WITH ORDINALITY AS m (person, n);
  UPDATE project.comment SET resolved = NULL WHERE id = (p ->> 'parent')::bigint AND resolved IS NOT NULL;
END
$$;

-- project:comment:resolve: the root resolved on the entry's day, or
-- reopened.
CREATE FUNCTION project.fold_comment_resolve(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE project.comment
  SET resolved = CASE WHEN (fold_comment_resolve.entry -> 'payload' ->> 'resolved')::boolean THEN (fold_comment_resolve.entry ->> 'date')::date END
  WHERE id = (fold_comment_resolve.entry -> 'payload' ->> 'comment')::bigint;
END;

-- project:comment:react: the actor's reaction to the comment its entry
-- names, on or off as it says.
CREATE FUNCTION project.fold_comment_react(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF (p ->> 'on')::boolean THEN
    INSERT INTO project.reaction (comment, person, emoji) VALUES ((p ->> 'comment')::bigint, entry ->> 'actor', p ->> 'emoji')
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM project.reaction WHERE comment = (p ->> 'comment')::bigint AND person = entry ->> 'actor' AND emoji = p ->> 'emoji';
  END IF;
END
$$;

SELECT cella.lets_fold('project:comment:post', 1, 'project.fold_comment_post(jsonb)', 'project');
SELECT cella.lets_fold('project:comment:resolve', 1, 'project.fold_comment_resolve(jsonb)', 'project');
SELECT cella.lets_fold('project:comment:react', 1, 'project.fold_comment_react(jsonb)', 'project');
