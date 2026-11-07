-- How each action that writes the timesheet feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- timesheet:entry:log: the entry under the id the entry names, its note
-- and its minutes as their commitments. An entry is logged with its time
-- (`timesheet.some_time`), so its minutes are one, the least an entry
-- holds, as a carried number that takes no null is; the feat's trigger
-- makes the member's period, as it did when it was logged.
CREATE FUNCTION timesheet.fold_log(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  n bigint := (entry ->> 'n')::bigint;
BEGIN
  PERFORM cella.commits('timesheet.entry.minutes', p ->> 'member', n, p -> 'minutes');
  INSERT INTO timesheet.entry (id, member, day, minutes, billable, note, circle)
  VALUES ((p ->> 'entry')::bigint, p ->> 'member', (p ->> 'day')::date, 1, (p ->> 'billable')::boolean,
          cella.commits('timesheet.entry.note', p ->> 'member', n, p -> 'note'), p ->> 'circle');
END
$$;

-- timesheet:entry:correct: the minutes the entry was brought to, as their
-- commitment; its column stays as its log folded it.
CREATE FUNCTION timesheet.fold_correct(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF p ->> 'member' IS NOT NULL THEN
    PERFORM cella.commits('timesheet.entry.minutes', p ->> 'member', (entry ->> 'n')::bigint, p -> 'minutes');
  END IF;
END
$$;

-- timesheet:period:submit: the member's month in the circle, submitted on
-- the entry's day; one submitted already keeps its first day.
CREATE FUNCTION timesheet.fold_submit(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO timesheet.period (member, month, circle, submitted)
  VALUES (fold_submit.entry -> 'payload' ->> 'member', fold_submit.entry -> 'payload' ->> 'month',
          fold_submit.entry -> 'payload' ->> 'circle', (fold_submit.entry ->> 'date')::date)
  ON CONFLICT (member, month, circle) DO UPDATE SET submitted = coalesce(timesheet.period.submitted, excluded.submitted);
END;

-- timesheet:period:approve: the month, approved on the entry's day by its
-- actor.
CREATE FUNCTION timesheet.fold_approve(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE timesheet.period SET approved = (fold_approve.entry ->> 'date')::date, approver = fold_approve.entry ->> 'actor'
  WHERE member = fold_approve.entry -> 'payload' ->> 'member' AND month = fold_approve.entry -> 'payload' ->> 'month'
    AND circle = fold_approve.entry -> 'payload' ->> 'circle';
END;

SELECT cella.lets_fold('timesheet:entry:log', 1, 'timesheet.fold_log(jsonb)', 'timesheet');
SELECT cella.lets_fold('timesheet:entry:correct', 1, 'timesheet.fold_correct(jsonb)', 'timesheet');
SELECT cella.lets_fold('timesheet:period:submit', 1, 'timesheet.fold_submit(jsonb)', 'timesheet');
SELECT cella.lets_fold('timesheet:period:approve', 1, 'timesheet.fold_approve(jsonb)', 'timesheet');
