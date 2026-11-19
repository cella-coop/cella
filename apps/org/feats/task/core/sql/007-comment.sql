-- task:comment:post: the comment is the actor's own, and is what its
-- payload names: its task, its parent, its text and its mentions, each in
-- the order its text gives them. A reply answers a root: a reply to a
-- reply is refused, naming the root to reply to, as is a mention of no
-- one the coop knows. That the actor may discuss in the task's circle is
-- the power's guard's, over the circle the payload names.
CREATE FUNCTION task.posts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no comment ' || coalesce(p.comment, 'is named')
    WHEN r.parent IS NOT NULL THEN 'comment ' || r.id || ' is a reply: reply to its root, comment ' || r.parent
    WHEN u.person IS NOT NULL THEN '@[' || u.person || '] names no one the coop knows: mention someone the picker offers'
    WHEN c.author IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not post as ' || c.author
    WHEN c.task IS DISTINCT FROM p.task
      OR c.parent IS DISTINCT FROM p.parent
      OR c.text IS DISTINCT FROM p.text
      OR ARRAY(SELECT m.person FROM task.mention m WHERE m.comment = c.id ORDER BY m.n)
         IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(coalesce(p.mentions, '[]')))
      THEN 'comment ' || c.id || ' was posted otherwise than its payload names'
  END
  FROM (
    SELECT payload ->> 'comment' AS comment, payload ->> 'task' AS task, (payload ->> 'parent')::bigint AS parent,
           payload ->> 'text' AS text, payload -> 'mentions' AS mentions
  ) p
  LEFT JOIN task.comment c ON c.id::text = p.comment
  LEFT JOIN task.comment r ON r.id = c.parent
  LEFT JOIN LATERAL (
    SELECT x.person FROM jsonb_array_elements_text(coalesce(p.mentions, '[]')) AS x (person)
    WHERE NOT EXISTS (SELECT FROM person.person q WHERE q.address = x.person)
    LIMIT 1
  ) u ON true;
END;

-- task:comment:resolve: only a root is resolved or reopened; resolving a
-- reply is refused, naming its root.
CREATE FUNCTION task.resolves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no comment ' || coalesce(p.comment, 'is named')
    WHEN c.parent IS NOT NULL THEN 'comment ' || c.id || ' is a reply: resolve its root, comment ' || c.parent
  END
  FROM (SELECT payload ->> 'comment' AS comment) p
  LEFT JOIN task.comment c ON c.id::text = p.comment;
END;

-- task:comment:react: a reaction is one of core body's fixed six, to a
-- comment there is, and is what its payload names, the actor's own on or
-- off; it is refused where the comment's circle has `reactions` off
-- (`circle.setting_of`), naming the circle and the rule that turned them
-- off and what would turn them on. That the actor may discuss in the
-- task's circle is the power's guard's.
CREATE FUNCTION task.reacts(payload jsonb) RETURNS text
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
    WHEN p.turned <> EXISTS (SELECT FROM task.reaction r WHERE r.comment = c.id AND r.person = cella.actor() AND r.emoji = p.emoji)
      THEN 'the reaction to comment ' || c.id || ' is not ' || CASE WHEN p.turned THEN 'on' ELSE 'off' END || ' as its payload names'
  END
  FROM (SELECT payload ->> 'comment' AS comment, payload ->> 'emoji' AS emoji, (payload ->> 'on')::boolean AS turned) p
  LEFT JOIN task.comment c ON c.id::text = p.comment
  LEFT JOIN LATERAL (SELECT x.policy, x.set_by FROM circle.settings(c.circle) x WHERE x.name = 'reactions') s ON true;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('task:comment:post', 'task.posts(jsonb)', 'task'),
  ('task:comment:resolve', 'task.resolves(jsonb)', 'task'),
  ('task:comment:react', 'task.reacts(jsonb)', 'task');
