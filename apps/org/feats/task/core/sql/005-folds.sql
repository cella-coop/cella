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

-- task:body:save: the body set to the snapshot its entry carries, in hex.
CREATE FUNCTION task.fold_body_save(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE task.task SET body = decode(fold_body_save.entry -> 'payload' ->> 'snapshot', 'hex')
  WHERE id = fold_body_save.entry -> 'payload' ->> 'task';
END;

SELECT cella.lets_fold('task:task:create', 1, 'task.fold_create(jsonb)', 'task');
SELECT cella.lets_fold('task:task:move', 1, 'task.fold_move(jsonb)', 'task');
SELECT cella.lets_fold('task:task:complete', 1, 'task.fold_complete(jsonb)', 'task');
SELECT cella.lets_fold('task:body:save', 1, 'task.fold_body_save(jsonb)', 'task');
