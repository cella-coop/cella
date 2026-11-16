-- Whose seat counts is core's to say, on a day (`circle_person.counts`),
-- as each kind of person says what bars one: membership the assembly's
-- but an active member's, and any of one it suspended or let go. A seat
-- a motion gives, and one its proposal asks, is to a person whose seat
-- counts in the circle on the verdict date, and a refusal says why not
-- (`circle_person.unseated`).
CREATE OR REPLACE FUNCTION membership_motion.seats(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN membership_motion.uncarried(payload ->> 'motion') THEN NULL
    WHEN s.id IS NULL THEN 'no seat ' || coalesce(p.seat::text, 'is named')
    WHEN s.since IS DISTINCT FROM cella.verdict_date() OR s.until IS NOT NULL
      THEN 'seat ' || s.id || ' was not added by this write'
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM membership_motion.seating g
      WHERE g.motion = d.id AND g.kind = 'seat' AND g.circle = s.circle AND g.member = s.member AND g.role IS NOT DISTINCT FROM s.role
    ) THEN d.id || ' does not seat ' || s.member || ' in ' || s.circle || coalesce(' as ' || s.role, '')
    WHEN NOT circle_person.counts(s.member, s.circle, cella.verdict_date())
      THEN s.member || ' may not sit in ' || s.circle || ': '
        || circle_person.unseated(s.member, s.circle, cella.verdict_date())
    WHEN EXISTS (
      SELECT FROM circle.seat o
      WHERE o.id <> s.id AND o.circle = s.circle AND o.member = s.member AND o.role IS NOT DISTINCT FROM s.role
        AND (o.until IS NULL OR o.until > cella.verdict_date())
    ) THEN s.member || ' already sits in ' || s.circle || coalesce(' as ' || s.role, '')
  END
  FROM (SELECT (payload ->> 'seat')::bigint AS seat, payload ->> 'motion' AS motion) p
  LEFT JOIN circle.seat s ON s.id = p.seat
  LEFT JOIN circle.circle c ON c.id = s.circle
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- A seat names a circle there is, or one an earlier `circle` action of
-- the same motion creates, and a role there is in it, or one an earlier
-- `role` action of the same motion makes there; a circle created names an
-- id in lower case that no circle or role has, and a name.
CREATE OR REPLACE FUNCTION membership_motion.circle_asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN c.id IS NULL AND NOT g.made THEN 'no circle ' || coalesce(g.circle, 'is named')
      WHEN g.kind = 'seat' AND NOT circle_person.counts(g.member, g.circle, cella.verdict_date())
        THEN coalesce(g.member, 'no one') || ' may not sit in ' || g.circle || ': '
          || circle_person.unseated(g.member, g.circle, cella.verdict_date())
      WHEN g.kind = 'seat' AND g.role IS NOT NULL AND NOT g.role_made
        AND NOT EXISTS (SELECT FROM circle.role x WHERE x.id = g.role AND x.circle IN (g.circle, '*'))
        THEN 'no role ' || g.role || ' in ' || g.circle
      WHEN g.kind = 'unseat' AND NOT EXISTS (
        SELECT FROM circle.seat o
        WHERE o.circle = g.circle AND o.member = g.member AND o.role IS NOT DISTINCT FROM g.role AND o.until IS NULL
      ) THEN coalesce(g.member, 'no one') || ' holds no such seat in ' || g.circle
      WHEN NOT motion.decides(d.circle, g.circle) AND NOT g.made
        THEN d.circle || ' may not decide who sits in ' || g.circle
    END AS r
    FROM (
      SELECT m.motion, m.kind, m.args ->> 'circle' AS circle, m.args ->> 'member' AS member, m.args ->> 'role' AS role,
             EXISTS (
               SELECT FROM motion.action o
               WHERE o.motion = m.motion AND o.n < m.n AND o.kind = 'circle' AND o.args ->> 'id' = m.args ->> 'circle'
             ) AS made,
             EXISTS (
               SELECT FROM motion.action o
               WHERE o.motion = m.motion AND o.n < m.n AND o.kind = 'role' AND o.args ->> 'id' = m.args ->> 'role'
                 AND o.args ->> 'circle' IN (m.args ->> 'circle', '*')
             ) AS role_made
      FROM motion.action m
      WHERE m.motion = payload ->> 'motion' AND m.kind IN ('seat', 'unseat')
    ) g
    JOIN motion.motion d ON d.id = g.motion
    LEFT JOIN circle.circle c ON c.id = g.circle
    UNION ALL
    SELECT CASE
      WHEN coalesce(m.args ->> 'id', '') !~ '^[a-z][a-z0-9-]*$'
        THEN 'a circle is created with an id in lower case, as design, not ' || coalesce(m.args ->> 'id', 'none')
      WHEN EXISTS (SELECT FROM circle.grantee x WHERE x.id = m.args ->> 'id')
        THEN 'a circle or a role ' || (m.args ->> 'id') || ' is there already'
      WHEN coalesce(m.args ->> 'name', '') !~ '\S' THEN 'a circle is created with a name'
    END
    FROM motion.action m
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'circle'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

