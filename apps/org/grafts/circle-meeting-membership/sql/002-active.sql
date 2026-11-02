-- The agenda's members are those who hold a seat that counts in its
-- circle on the verdict date (`circle_membership.sits_in`): any person,
-- and in the assembly an active member, as membership says one is that
-- day, not by a copy of its status.
CREATE OR REPLACE FUNCTION circle_meeting_membership.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.id IS NULL THEN 'no meeting ' || coalesce(w.meeting, 'is named')
    WHEN cella.actor() IS NULL THEN 'an agenda is drawn up by a member of its circle, and this write has no actor'
    WHEN NOT circle_membership.sits_in(cella.actor(), m.circle, cella.verdict_date())
      THEN cella.actor() || ' holds no seat in ' || m.circle || ': its agenda is its members'''
  END
  FROM (SELECT payload ->> 'meeting' AS meeting) w
  LEFT JOIN meeting.meeting m ON m.id = w.meeting;
END;
