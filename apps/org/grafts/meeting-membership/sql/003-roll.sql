-- Who is expected at a meeting: the members seated in its circle on its
-- day, each with their mark if they have one, and the members marked who
-- are not seated there, who came as guests.
CREATE VIEW meeting_membership.roll WITH (security_invoker = true) AS
SELECT m.id AS meeting, s.member, true AS seated, a.status
FROM meeting.meeting m
CROSS JOIN LATERAL circle.seated(m.circle, m.at::date) AS s(member)
LEFT JOIN meeting_membership.attendance a ON a.meeting = m.id AND a.member = s.member
UNION ALL
SELECT a.meeting, a.member, false, a.status
FROM meeting_membership.attendance a
JOIN meeting.meeting m ON m.id = a.meeting
WHERE NOT EXISTS (SELECT FROM circle.seated(m.circle, m.at::date) s WHERE s = a.member);

-- Whether a meeting is quorate: its seats, the seated members present,
-- and how many must be, the circle's share of its seats rounded up.
-- Guests count for nothing.
CREATE VIEW meeting_membership.quorum WITH (security_invoker = true) AS
SELECT m.id AS meeting,
       count(r.member) FILTER (WHERE r.seated)::integer AS seats,
       count(r.member) FILTER (WHERE r.seated AND r.status = 'present')::integer AS present,
       ceil(count(r.member) FILTER (WHERE r.seated) * coalesce(s.quorum, 50) / 100.0)::integer AS needed
FROM meeting.meeting m
LEFT JOIN meeting_membership.roll r ON r.meeting = m.id
LEFT JOIN meeting.setting s ON s.circle = m.circle
GROUP BY m.id, s.quorum;

-- meeting:item:add, :move, :remove — the actor is an active member
-- seated in the meeting's circle on the verdict date: the participant's
-- `discuss`, which membership.may finds on any seat, is held in
-- the meeting's circle.
CREATE FUNCTION meeting_membership.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.id IS NULL THEN 'no meeting ' || coalesce(w.meeting, 'is named')
    WHEN cella.actor() IS NULL THEN 'an agenda is drawn up by a member of its circle, and this write has no actor'
    WHEN NOT EXISTS (SELECT FROM circle.seated(m.circle, cella.verdict_date()) s WHERE s = cella.actor())
      OR NOT EXISTS (SELECT FROM membership.member mm WHERE mm.address = cella.actor() AND mm.status = 'active')
      THEN cella.actor() || ' holds no seat in ' || m.circle || ': its agenda is its members'''
  END
  FROM (SELECT payload ->> 'meeting' AS meeting) w
  LEFT JOIN meeting.meeting m ON m.id = w.meeting;
END;

-- meeting-membership:attendance:record — the minutes' keeper records only
-- those expected, the members seated in the meeting's circle on its day;
-- anyone else marks themselves, as a guest.
CREATE FUNCTION meeting_membership.records(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.id IS NULL THEN 'no meeting ' || coalesce(w.meeting, 'is named')
    WHEN NOT EXISTS (SELECT FROM circle.seated(m.circle, m.at::date) s WHERE s = w.member)
      THEN coalesce(w.member, 'no one') || ' holds no seat in ' || m.circle || ' on ' || to_char(m.at, 'YYYY-MM-DD')
        || ': only they may mark themselves, as a guest'
  END
  FROM (SELECT payload ->> 'meeting' AS meeting, payload ->> 'member' AS member) w
  LEFT JOIN meeting.meeting m ON m.id = w.meeting;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('meeting:item:add', 'meeting_membership.sits(jsonb)', 'meeting-membership'),
  ('meeting:item:move', 'meeting_membership.sits(jsonb)', 'meeting-membership'),
  ('meeting:item:remove', 'meeting_membership.sits(jsonb)', 'meeting-membership'),
  ('meeting-membership:attendance:record', 'meeting_membership.records(jsonb)', 'meeting-membership');

GRANT USAGE ON SCHEMA meeting_membership TO cella_app, cella_guards;
GRANT SELECT ON meeting_membership.roll, meeting_membership.quorum TO cella_app, cella_guards;
