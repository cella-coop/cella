-- How each action that writes the meeting feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- meeting:meeting:schedule: the meeting under the id the entry names, of
-- its circle, at its time, titled and placed as the entry says, scheduled
-- on the entry's day.
CREATE FUNCTION meeting.fold_schedule(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO meeting.meeting (id, circle, title, at, place, link, scheduled)
  VALUES (fold_schedule.entry -> 'payload' ->> 'meeting', fold_schedule.entry -> 'payload' ->> 'circle',
          fold_schedule.entry -> 'payload' ->> 'title', (fold_schedule.entry -> 'payload' ->> 'at')::timestamp,
          fold_schedule.entry -> 'payload' ->> 'place', fold_schedule.entry -> 'payload' ->> 'link',
          (fold_schedule.entry ->> 'date')::date);
END;

-- meeting:item:add: the item under the id the entry names, at the
-- position the entry gives as its text, its title, or where its member
-- signed it blank for an extending graft to fill, the one it took,
-- `named`, and its presenter as its commitment;
-- the feat's trigger puts it in its meeting's circle, as it did when it
-- was added.
CREATE FUNCTION meeting.fold_add(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO meeting.item (id, meeting, pos, title, presenter, minutes) OVERRIDING SYSTEM VALUE
  VALUES ((p ->> 'item')::bigint, p ->> 'meeting', (p ->> 'pos')::double precision, coalesce(nullif(p ->> 'title', ''), p ->> 'named'),
          coalesce(cella.commits('meeting.item.presenter', p ->> 'item', (entry ->> 'n')::bigint, p -> 'presenter'), ''),
          (p ->> 'minutes')::integer);
END
$$;

-- meeting:item:move: the item at the position the entry gives as its
-- text.
CREATE FUNCTION meeting.fold_move(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE meeting.item SET pos = (fold_move.entry -> 'payload' ->> 'pos')::double precision
  WHERE meeting = fold_move.entry -> 'payload' ->> 'meeting' AND id = (fold_move.entry -> 'payload' ->> 'item')::bigint;
END;

-- meeting:item:remove: the item dropped from its agenda.
CREATE FUNCTION meeting.fold_remove(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  DELETE FROM meeting.item
  WHERE meeting = fold_remove.entry -> 'payload' ->> 'meeting' AND id = (fold_remove.entry -> 'payload' ->> 'item')::bigint;
END;

-- meeting:meeting:hold: the meeting held on the entry's day.
CREATE FUNCTION meeting.fold_hold(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE meeting.meeting SET status = 'held', settled = (fold_hold.entry ->> 'date')::date
  WHERE id = fold_hold.entry -> 'payload' ->> 'meeting';
END;

-- meeting:meeting:cancel: the meeting cancelled on the entry's day.
CREATE FUNCTION meeting.fold_cancel(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE meeting.meeting SET status = 'cancelled', settled = (fold_cancel.entry ->> 'date')::date
  WHERE id = fold_cancel.entry -> 'payload' ->> 'meeting';
END;

-- meeting:meeting:minute: the minutes begun on the entry's day; begun
-- already, they keep their first.
CREATE FUNCTION meeting.fold_minute(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE meeting.meeting SET minuted = coalesce(minuted, (fold_minute.entry ->> 'date')::date)
  WHERE id = fold_minute.entry -> 'payload' ->> 'meeting';
END;

SELECT cella.lets_fold('meeting:meeting:schedule', 1, 'meeting.fold_schedule(jsonb)', 'meeting');
SELECT cella.lets_fold('meeting:item:add', 1, 'meeting.fold_add(jsonb)', 'meeting');
SELECT cella.lets_fold('meeting:item:move', 1, 'meeting.fold_move(jsonb)', 'meeting');
SELECT cella.lets_fold('meeting:item:remove', 1, 'meeting.fold_remove(jsonb)', 'meeting');
SELECT cella.lets_fold('meeting:meeting:hold', 1, 'meeting.fold_hold(jsonb)', 'meeting');
SELECT cella.lets_fold('meeting:meeting:cancel', 1, 'meeting.fold_cancel(jsonb)', 'meeting');
SELECT cella.lets_fold('meeting:meeting:minute', 1, 'meeting.fold_minute(jsonb)', 'meeting');
