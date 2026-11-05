-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds").

-- meeting-membership:attendance:mark and :record: the member's mark at the
-- meeting, the last winning, made on the entry's day by its actor; the
-- graft's trigger refuses it once the meeting is held, as it did.
CREATE FUNCTION meeting_membership.fold_mark(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO meeting_membership.attendance (meeting, member, status, marked, by)
  VALUES (fold_mark.entry -> 'payload' ->> 'meeting', fold_mark.entry -> 'payload' ->> 'member',
          fold_mark.entry -> 'payload' ->> 'status', (fold_mark.entry ->> 'date')::date, fold_mark.entry ->> 'actor')
  ON CONFLICT (meeting, member) DO UPDATE SET status = excluded.status, marked = excluded.marked, by = excluded.by;
END;

CREATE FUNCTION meeting_membership.fold_record(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO meeting_membership.attendance (meeting, member, status, marked, by)
  VALUES (fold_record.entry -> 'payload' ->> 'meeting', fold_record.entry -> 'payload' ->> 'member',
          fold_record.entry -> 'payload' ->> 'status', (fold_record.entry ->> 'date')::date, fold_record.entry ->> 'actor')
  ON CONFLICT (meeting, member) DO UPDATE SET status = excluded.status, marked = excluded.marked, by = excluded.by;
END;

SELECT cella.lets_fold('meeting-membership:attendance:mark', 1, 'meeting_membership.fold_mark(jsonb)', 'meeting-membership');
SELECT cella.lets_fold('meeting-membership:attendance:record', 1, 'meeting_membership.fold_record(jsonb)', 'meeting-membership');
