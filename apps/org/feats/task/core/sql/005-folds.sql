-- How each action that writes the task feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- task:task:create: the task under the id the entry names, its title as
-- its commitment, its priority, due day and status as the entry says,
-- made on the entry's day.
CREATE FUNCTION task.fold_create(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO task.task (id, title, priority, due, status, created)
  VALUES (p ->> 'task', cella.commits('task.task.title', p ->> 'task', (entry ->> 'n')::bigint, p -> 'title'),
          p ->> 'priority', (p ->> 'due')::date, p ->> 'status', (entry ->> 'date')::date);
END
$$;

-- task:task:move: the status the entry names, short of done, which
-- reopens a done task.
CREATE FUNCTION task.fold_move(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE task.task SET status = fold_move.entry -> 'payload' ->> 'status', completed = NULL
  WHERE id = fold_move.entry -> 'payload' ->> 'task';
END;

-- task:task:complete: the task done on the entry's day; done already, it
-- keeps its first.
CREATE FUNCTION task.fold_complete(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE task.task SET status = 'done', completed = coalesce(completed, (fold_complete.entry ->> 'date')::date)
  WHERE id = fold_complete.entry -> 'payload' ->> 'task';
END;

-- task:task:set: the priority and the due day the entry carries, each
-- only if it names it; a due day of null clears it.
CREATE FUNCTION task.fold_set(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE task.task
  SET priority = coalesce(fold_set.entry -> 'payload' ->> 'priority', priority),
      due = CASE WHEN fold_set.entry -> 'payload' ? 'due' THEN (fold_set.entry -> 'payload' ->> 'due')::date ELSE due END
  WHERE id = fold_set.entry -> 'payload' ->> 'task';
END;

-- task:body:save: the body set to the snapshot its entry carries, in hex.
CREATE FUNCTION task.fold_body_save(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE task.task SET body = decode(fold_body_save.entry -> 'payload' ->> 'snapshot', 'hex')
  WHERE id = fold_body_save.entry -> 'payload' ->> 'task';
END;

-- task:comment:post: the comment under the receipt its entry names, by
-- its actor on its day, in its task's circle, and each mention its entry
-- names in order; a reply reopens its root.
CREATE FUNCTION task.fold_comment_post(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO task.comment (id, task, author, parent, text, posted)
  VALUES ((p ->> 'comment')::bigint, p ->> 'task', entry ->> 'actor', (p ->> 'parent')::bigint, p ->> 'text', (entry ->> 'date')::date);
  INSERT INTO task.mention (comment, n, person)
  SELECT (p ->> 'comment')::bigint, m.n, m.person
  FROM jsonb_array_elements_text(coalesce(p -> 'mentions', '[]')) WITH ORDINALITY AS m (person, n);
  UPDATE task.comment SET resolved = NULL WHERE id = (p ->> 'parent')::bigint AND resolved IS NOT NULL;
END
$$;

-- task:comment:resolve: the root resolved on the entry's day, or
-- reopened.
CREATE FUNCTION task.fold_comment_resolve(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE task.comment
  SET resolved = CASE WHEN (fold_comment_resolve.entry -> 'payload' ->> 'resolved')::boolean THEN (fold_comment_resolve.entry ->> 'date')::date END
  WHERE id = (fold_comment_resolve.entry -> 'payload' ->> 'comment')::bigint;
END;

-- task:comment:react: the actor's reaction to the comment its entry
-- names, on or off as it says.
CREATE FUNCTION task.fold_comment_react(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF (p ->> 'on')::boolean THEN
    INSERT INTO task.reaction (comment, person, emoji) VALUES ((p ->> 'comment')::bigint, entry ->> 'actor', p ->> 'emoji')
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM task.reaction WHERE comment = (p ->> 'comment')::bigint AND person = entry ->> 'actor' AND emoji = p ->> 'emoji';
  END IF;
END
$$;

SELECT cella.lets_fold('task:task:create', 1, 'task.fold_create(jsonb)', 'task');
SELECT cella.lets_fold('task:task:move', 1, 'task.fold_move(jsonb)', 'task');
SELECT cella.lets_fold('task:task:complete', 1, 'task.fold_complete(jsonb)', 'task');
SELECT cella.lets_fold('task:task:set', 1, 'task.fold_set(jsonb)', 'task');
SELECT cella.lets_fold('task:body:save', 1, 'task.fold_body_save(jsonb)', 'task');
SELECT cella.lets_fold('task:comment:post', 1, 'task.fold_comment_post(jsonb)', 'task');
SELECT cella.lets_fold('task:comment:resolve', 1, 'task.fold_comment_resolve(jsonb)', 'task');
SELECT cella.lets_fold('task:comment:react', 1, 'task.fold_comment_react(jsonb)', 'task');
