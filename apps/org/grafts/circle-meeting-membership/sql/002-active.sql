-- The agenda's members are active as membership says one is, on the
-- verdict date (`membership.active`), not by a copy of its status.
CREATE OR REPLACE FUNCTION circle_meeting_membership.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.id IS NULL THEN 'no meeting ' || coalesce(w.meeting, 'is named')
    WHEN cella.actor() IS NULL THEN 'an agenda is drawn up by a member of its circle, and this write has no actor'
    WHEN NOT EXISTS (SELECT FROM circle_membership.seated(m.circle, cella.verdict_date()) s WHERE s = cella.actor())
      OR NOT membership.active(cella.actor(), cella.verdict_date())
      THEN cella.actor() || ' holds no seat in ' || m.circle || ': its agenda is its members'''
  END
  FROM (SELECT payload ->> 'meeting' AS meeting) w
  LEFT JOIN meeting.meeting m ON m.id = w.meeting;
END;
