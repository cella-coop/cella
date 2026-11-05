-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds").

-- membership-task:task:assign: the task given to the member the entry
-- names, or taken from whoever had it where it names none; the graft's
-- trigger refuses one not an active member on the entry's day, as it did.
CREATE FUNCTION membership_task.fold_assign(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF p ->> 'member' IS NULL THEN
    DELETE FROM membership_task.assignment WHERE task = p ->> 'task';
  ELSE
    INSERT INTO membership_task.assignment (task, member) VALUES (p ->> 'task', p ->> 'member')
    ON CONFLICT (task) DO UPDATE SET member = excluded.member;
  END IF;
END
$$;

SELECT cella.lets_fold('membership-task:task:assign', 1, 'membership_task.fold_assign(jsonb)', 'membership-task');
