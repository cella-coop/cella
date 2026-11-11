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

-- membership:member:admit — an admission a close carries, an effect in
-- the close's transaction, seats the member it admits in the motion's
-- circle as `member`, as `seats` judges a seat of its own. That the
-- motion asks it, with its shares, is `admits`; that the write admitted
-- them, `membership.admitted`. An admission no passed close carries is
-- the motion feat's to refuse (`motion.carried`), so this one says nothing
-- of it, and that reason comes first.
CREATE FUNCTION membership_motion.closes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN membership_motion.uncarried(payload ->> 'motion') THEN NULL
    WHEN s.id IS NULL OR s.member IS DISTINCT FROM payload ->> 'member'
      THEN coalesce(payload ->> 'motion', 'no motion') || ' admits a member this write seats nowhere: an admission seats its member in the motion''s circle'
    ELSE membership_motion.seats(jsonb_build_object('seat', s.id, 'motion', payload ->> 'motion'))
  END
  FROM (SELECT (payload ->> 'seat')::bigint AS seat) p
  LEFT JOIN circle.seat s ON s.id = p.seat;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'membership_motion.circle_asks(jsonb)', 'membership-motion'),
  ('membership:member:admit', 'membership_motion.closes(jsonb)', 'membership-motion');
