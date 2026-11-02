-- Whose seat counts is circle-membership's to say, on a day
-- (`circle_membership.counts`): any person's whom membership has not
-- suspended or let go, and in the assembly an active member's. Who gives a
-- stance, who counts while a motion is open and who is counted at its
-- close read it on the verdict date, not a copy of the member's status;
-- who puts, closes and deliberates on a motion, and who is seated by one,
-- is whoever holds, or may hold, a seat that counts in its circle.
CREATE OR REPLACE FUNCTION circle_membership_motion.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is named')
    WHEN NOT circle_membership.sits_in(cella.actor(), d.circle, cella.verdict_date())
      THEN cella.actor() || ' holds no seat in ' || d.circle || ', so may not ' || split_part(cella.action(), ':', 3) || ' ' || d.id
  END
  FROM (SELECT payload ->> 'motion' AS motion) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

CREATE OR REPLACE FUNCTION circle_membership_motion.seats(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.id IS NULL THEN 'no seat ' || coalesce(p.seat::text, 'is named')
    WHEN s.since IS DISTINCT FROM cella.verdict_date() OR s.until IS NOT NULL
      THEN 'seat ' || s.id || ' was not added by this write'
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM circle_membership_motion.seating g
      WHERE g.motion = d.id AND g.kind = 'seat' AND g.circle = s.circle AND g.member = s.member AND g.role IS NOT DISTINCT FROM s.role
    ) THEN d.id || ' does not seat ' || s.member || ' in ' || s.circle || coalesce(' as ' || s.role, '')
    WHEN NOT circle_membership.counts(s.member, s.circle, cella.verdict_date())
      THEN s.member || ' may not sit in ' || s.circle || ': '
        || CASE WHEN c.parent IS NULL THEN 'its seats are its active members''' ELSE 'no person the co-op knows, or one membership suspended or let go' END
    WHEN EXISTS (
      SELECT FROM circle_membership.seat o
      WHERE o.id <> s.id AND o.circle = s.circle AND o.member = s.member AND o.role IS NOT DISTINCT FROM s.role
        AND (o.until IS NULL OR o.until > cella.verdict_date())
    ) THEN s.member || ' already sits in ' || s.circle || coalesce(' as ' || s.role, '')
  END
  FROM (SELECT (payload ->> 'seat')::bigint AS seat, payload ->> 'motion' AS motion) p
  LEFT JOIN circle_membership.seat s ON s.id = p.seat
  LEFT JOIN circle.circle c ON c.id = s.circle
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- motion:motion:vote — the actor holds `vote`, the power the motion's
-- procedure gives the seats on its roll: they are on the roll, and their
-- seat counts in its circle on the verdict date.
CREATE OR REPLACE FUNCTION circle_membership_motion.on_roll(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT FROM circle_membership_motion.roll r WHERE r.motion = p.motion AND r.member = p.member
    ) THEN coalesce(p.member, 'no one') || ' is not on the roll of ' || coalesce(p.motion, 'no motion')
    WHEN NOT circle_membership.counts(p.member, d.circle, cella.verdict_date())
      THEN p.member || CASE WHEN c.parent IS NULL THEN ' is not an active member' ELSE ' may sit in ' || d.circle || ' no longer' END
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'member' AS member) p
  LEFT JOIN motion.motion d ON d.id = p.motion
  LEFT JOIN circle.circle c ON c.id = d.circle;
END;

CREATE OR REPLACE FUNCTION circle_membership_motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN c.id IS NULL THEN 'no circle ' || coalesce(g.circle, 'is named')
      WHEN g.kind = 'seat' AND NOT circle_membership.counts(g.member, g.circle, cella.verdict_date())
        THEN coalesce(g.member, 'no one') || ' may not sit in ' || g.circle || ': '
          || CASE WHEN c.parent IS NULL THEN 'its seats are its active members''' ELSE 'no person the co-op knows, or one membership suspended or let go' END
      WHEN g.kind = 'seat' AND g.role IS NOT NULL
        AND NOT EXISTS (SELECT FROM circle.role x WHERE x.id = g.role AND x.circle IN (g.circle, '*'))
        THEN 'no role ' || g.role || ' in ' || g.circle
      WHEN g.kind = 'unseat' AND NOT EXISTS (
        SELECT FROM circle_membership.seat o
        WHERE o.circle = g.circle AND o.member = g.member AND o.role IS NOT DISTINCT FROM g.role AND o.until IS NULL
      ) THEN coalesce(g.member, 'no one') || ' holds no such seat in ' || g.circle
      WHEN NOT circle_motion.decides(d.circle, g.circle)
        THEN d.circle || ' may not decide who sits in ' || g.circle
    END AS r
    FROM (
      SELECT m.motion, m.kind, m.args ->> 'circle' AS circle, m.args ->> 'member' AS member, m.args ->> 'role' AS role
      FROM motion.action m
      WHERE m.motion = payload ->> 'motion' AND m.kind IN ('seat', 'unseat')
    ) g
    JOIN motion.motion d ON d.id = g.motion
    LEFT JOIN circle.circle c ON c.id = g.circle
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

CREATE OR REPLACE FUNCTION circle_membership_motion.electorate(ref text) RETURNS SETOF text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT c.member
  FROM circle_membership_motion.counted c
  JOIN motion.motion d ON d.id = c.motion AND d.closed IS NOT NULL
  WHERE c.motion = ref
  UNION
  SELECT r.member
  FROM circle_membership_motion.roll r
  JOIN motion.motion d ON d.id = r.motion AND d.closed IS NULL
  WHERE r.motion = ref AND circle_membership.counts(r.member, d.circle, cella.verdict_date());
END;

CREATE OR REPLACE FUNCTION circle_membership_motion.count_roll() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO circle_membership_motion.counted (motion, member)
  SELECT r.motion, r.member
  FROM circle_membership_motion.roll r
  WHERE r.motion = NEW.id AND membership.active(r.member, cella.verdict_date());
  RETURN NULL;
END
$$;
