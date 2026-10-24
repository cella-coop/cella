CREATE SCHEMA circle_meeting_member;

-- Who is expected at a meeting: the members seated in its circle on its
-- day, each with their mark if they have one, and the members marked who
-- are not seated there, who came as guests.
CREATE VIEW circle_meeting_member.roll AS
SELECT m.id AS meeting, s.member, true AS seated, a.status
FROM meeting.meeting m
CROSS JOIN LATERAL circle_member.seated(m.circle, m.at::date) AS s(member)
LEFT JOIN meeting_member.attendance a ON a.meeting = m.id AND a.member = s.member
UNION ALL
SELECT a.meeting, a.member, false, a.status
FROM meeting_member.attendance a
JOIN meeting.meeting m ON m.id = a.meeting
WHERE NOT EXISTS (SELECT FROM circle_member.seated(m.circle, m.at::date) s WHERE s = a.member);

-- Whether a meeting is quorate: its seats, the seated members present,
-- and how many must be, the circle's share of its seats rounded up.
-- Guests count for nothing.
CREATE VIEW circle_meeting_member.quorum AS
SELECT m.id AS meeting,
       count(r.member) FILTER (WHERE r.seated)::integer AS seats,
       count(r.member) FILTER (WHERE r.seated AND r.status = 'present')::integer AS present,
       ceil(count(r.member) FILTER (WHERE r.seated) * coalesce(s.quorum, 50) / 100.0)::integer AS needed
FROM meeting.meeting m
LEFT JOIN circle_meeting_member.roll r ON r.meeting = m.id
LEFT JOIN circle_meeting.setting s ON s.circle = m.circle
GROUP BY m.id, s.quorum;

-- meeting:item:add, :move, :remove — the actor is an active member
-- seated in the meeting's circle on the verdict date: the agenda is its
-- members'.
CREATE FUNCTION circle_meeting_member.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.id IS NULL THEN 'no meeting ' || coalesce(w.meeting, 'is named')
    WHEN cella.actor() IS NULL THEN 'an agenda is drawn up by a member of its circle, and this write has no actor'
    WHEN NOT EXISTS (SELECT FROM circle_member.seated(m.circle, cella.verdict_date()) s WHERE s = cella.actor())
      OR NOT EXISTS (SELECT FROM member.member mm WHERE mm.address = cella.actor() AND mm.status = 'active')
      THEN cella.actor() || ' holds no seat in ' || m.circle || ': its agenda is its members'''
  END
  FROM (SELECT payload ->> 'meeting' AS meeting) w
  LEFT JOIN meeting.meeting m ON m.id = w.meeting;
END;

-- Every meeting write with a power — scheduling, holding, cancelling,
-- beginning the minutes and recording another's attendance — the
-- actor's power reaches the meeting's circle (`circle_member.over`): a
-- lead schedules their own circle's meetings, the gérante, seated in the
-- assembly, any circle's.
CREATE FUNCTION circle_meeting_member.reaches(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.id IS NULL THEN NULL
    WHEN NOT circle_member.over(cella.actor(), w.power, m.circle, cella.verdict_date())
      THEN coalesce(cella.actor(), 'no one') || ' holds ' || coalesce(w.power, 'no power') || ' over no circle that holds ' || m.id
  END
  FROM (
    SELECT payload ->> 'meeting' AS meeting, (SELECT p.power FROM cella.power p WHERE p.op = cella.op()) AS power
  ) w
  LEFT JOIN meeting.meeting m ON m.id = w.meeting;
END;

-- meeting-member:attendance:record — the minutes' keeper records only
-- those expected, the members seated in the meeting's circle on its day;
-- anyone else marks themselves, as a guest.
CREATE FUNCTION circle_meeting_member.records(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.id IS NULL THEN 'no meeting ' || coalesce(w.meeting, 'is named')
    WHEN NOT EXISTS (SELECT FROM circle_member.seated(m.circle, m.at::date) s WHERE s = w.member)
      THEN coalesce(w.member, 'no one') || ' holds no seat in ' || m.circle || ' on ' || to_char(m.at, 'YYYY-MM-DD')
        || ': only they may mark themselves, as a guest'
  END
  FROM (SELECT payload ->> 'meeting' AS meeting, payload ->> 'member' AS member) w
  LEFT JOIN meeting.meeting m ON m.id = w.meeting;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('meeting:item:add', 'circle_meeting_member.sits(jsonb)', 'circle-meeting-member'),
  ('meeting:item:move', 'circle_meeting_member.sits(jsonb)', 'circle-meeting-member'),
  ('meeting:item:remove', 'circle_meeting_member.sits(jsonb)', 'circle-meeting-member'),
  ('meeting:meeting:schedule', 'circle_meeting_member.reaches(jsonb)', 'circle-meeting-member'),
  ('meeting:meeting:hold', 'circle_meeting_member.reaches(jsonb)', 'circle-meeting-member'),
  ('meeting:meeting:cancel', 'circle_meeting_member.reaches(jsonb)', 'circle-meeting-member'),
  ('meeting:meeting:minute', 'circle_meeting_member.reaches(jsonb)', 'circle-meeting-member'),
  ('meeting-member:attendance:record', 'circle_meeting_member.reaches(jsonb)', 'circle-meeting-member'),
  ('meeting-member:attendance:record', 'circle_meeting_member.records(jsonb)', 'circle-meeting-member');

GRANT USAGE ON SCHEMA circle_meeting_member TO cella_app, cella_rules;
GRANT SELECT ON circle_meeting_member.roll, circle_meeting_member.quorum TO cella_app, cella_rules;
