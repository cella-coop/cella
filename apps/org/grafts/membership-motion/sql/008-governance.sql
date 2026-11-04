-- motion:motion:vote — the member is on the motion's roll, and
-- active: a suspended or exited member gives no stance, as their stance
-- would not be counted.
CREATE OR REPLACE FUNCTION membership_motion.on_roll(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT FROM membership_motion.roll r WHERE r.motion = p.motion AND r.member = p.member
    ) THEN coalesce(p.member, 'no one') || ' is not on the roll of ' || coalesce(p.motion, 'no motion')
    WHEN NOT EXISTS (SELECT FROM membership.member m WHERE m.address = p.member AND m.status = 'active')
      THEN p.member || ' is not an active member'
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'member' AS member) p;
END;

-- motion:motion:propose — who decides what of seats: a seat is the
-- motion of a circle that may decide about its circle, never its own
-- but for the assembly's (`motion.decides`), and names an
-- active member for a role of that circle; ending one names a seat held.
-- Which circle admits, suspends and lets members go is the collective
-- mandates', which the motion feat's guard `empowers` reads.
CREATE FUNCTION membership_motion.circle_asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = g.circle) THEN 'no circle ' || coalesce(g.circle, 'is named')
      WHEN g.kind = 'seat' AND NOT EXISTS (SELECT FROM membership.member m WHERE m.address = g.member AND m.status = 'active')
        THEN coalesce(g.member, 'no one') || ' is not an active member'
      WHEN g.kind = 'seat' AND g.role IS NOT NULL
        AND NOT EXISTS (SELECT FROM circle.role x WHERE x.id = g.role AND x.circle IN (g.circle, '*'))
        THEN 'no role ' || g.role || ' in ' || g.circle
      WHEN g.kind = 'unseat' AND NOT EXISTS (
        SELECT FROM circle.seat o
        WHERE o.id IS NOT NULL AND o.circle = g.circle AND o.member = g.member AND o.role IS NOT DISTINCT FROM g.role AND o.until IS NULL
      ) THEN coalesce(g.member, 'no one') || ' holds no such seat in ' || g.circle
      WHEN NOT motion.decides(d.circle, g.circle)
        THEN d.circle || ' may not decide who sits in ' || g.circle
    END AS r
    FROM (
      SELECT m.motion, m.kind, m.args ->> 'circle' AS circle, m.args ->> 'member' AS member, m.args ->> 'role' AS role
      FROM motion.action m
      WHERE m.motion = payload ->> 'motion' AND m.kind IN ('seat', 'unseat')
    ) g
    JOIN motion.motion d ON d.id = g.motion
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- motion:motion:close — a passing close admits, in its own
-- transaction, everyone the motion admits, and seats each in the
-- motion's circle as `member` (`seats`, as on a seat of its own); a
-- close that does not pass admits no one. Its payload's `admitted` names
-- each member and their seat. That each admission is one the motion
-- asks, with its shares, is membership-motion's guard on the close.
CREATE FUNCTION membership_motion.settles(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL OR d.closed IS NULL THEN NULL
    WHEN coalesce(membership_motion.passes(d.id), false) THEN (
      SELECT r FROM (
        SELECT CASE
          WHEN a.member IS NULL THEN d.id || ' passes, and its close does not admit ' || m.member
          ELSE membership_motion.seats(jsonb_build_object('seat', a.seat, 'motion', d.id))
        END AS r
        FROM membership_motion.action m
        LEFT JOIN jsonb_to_recordset(coalesce(payload -> 'admitted', '[]'::jsonb)) AS a(member text, seat bigint)
          ON a.member = m.member
        WHERE m.motion = d.id AND m.kind = 'admit'
      ) x
      WHERE r IS NOT NULL
      LIMIT 1
    )
    WHEN jsonb_array_length(coalesce(payload -> 'admitted', '[]'::jsonb)) > 0
      THEN d.id || ' does not pass, so its close admits no one'
  END
  FROM (SELECT payload ->> 'motion' AS id) p
  LEFT JOIN motion.motion d ON d.id = p.id;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'membership_motion.circle_asks(jsonb)', 'membership-motion'),
  ('motion:motion:close', 'membership_motion.settles(jsonb)', 'membership-motion');
