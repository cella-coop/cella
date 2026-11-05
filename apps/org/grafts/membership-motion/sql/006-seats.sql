-- circle:seat:add and :remove cite a motion: the motion feat
-- attaches membership-motion's `carried` to them as it registers
-- them, as to every action listed.
SELECT motion.register_cite('circle:seat:add', 'seat-member', 'membership-motion');
SELECT motion.register_cite('circle:seat:remove', 'seat-member', 'membership-motion');

-- What a motion may decide of seats, registered with the motion feat
-- so its New form offers them: seating a member in a circle, in one of
-- its roles or as a plain member, and ending such a seat.
SELECT motion.register_carries('seat', 'Seat a member', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "member", "label": "Address", "type": "text"}, {"name": "role", "label": "Role", "type": "text", "optional": true}]', 'circle:seat:add', 'membership-motion');
SELECT motion.register_carries('unseat', 'End a seat', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "member", "label": "Address", "type": "text"}, {"name": "role", "label": "Role", "type": "text", "optional": true}]', 'circle:seat:remove', 'membership-motion');

-- A circle a motion creates, carried out by core's circle:circle:create
-- under the collective mandate `create-circle`: its id, name and purpose.
-- A later `seat` of the same motion may name it.
SELECT motion.register_cite('circle:circle:create', 'create-circle', 'membership-motion');
SELECT motion.register_carries('circle', 'Create a circle', '[{"name": "id", "label": "Id", "type": "text"}, {"name": "name", "label": "Name", "type": "text"}, {"name": "purpose", "label": "Purpose", "type": "text", "optional": true}]', 'circle:circle:create', 'membership-motion');

-- The seats motions give and end: an admission seats the member in the
-- motion's circle as `member`; a `seat` or `unseat` action names its
-- circle, member and role, none for a plain seat.
CREATE VIEW membership_motion.seating WITH (security_invoker = true) AS
SELECT m.motion, m.n, m.kind, m.args ->> 'circle' AS circle, m.args ->> 'member' AS member, m.args ->> 'role' AS role
FROM motion.action m
WHERE m.kind IN ('seat', 'unseat')
UNION ALL
SELECT a.motion, a.n, 'seat', d.circle, a.member, 'member'
FROM membership_motion.action a
JOIN motion.motion d ON d.id = a.motion
WHERE a.kind = 'admit';

-- circle:seat:add — the seat is one the cited motion gives,
-- to an active member, from the verdict date, where they held no such
-- seat before.
CREATE FUNCTION membership_motion.seats(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.id IS NULL THEN 'no seat ' || coalesce(p.seat::text, 'is named')
    WHEN s.since IS DISTINCT FROM cella.verdict_date() OR s.until IS NOT NULL
      THEN 'seat ' || s.id || ' was not added by this write'
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM membership_motion.seating g
      WHERE g.motion = d.id AND g.kind = 'seat' AND g.circle = s.circle AND g.member = s.member AND g.role IS NOT DISTINCT FROM s.role
    ) THEN d.id || ' does not seat ' || s.member || ' in ' || s.circle || coalesce(' as ' || s.role, '')
    WHEN NOT EXISTS (SELECT FROM membership.member m WHERE m.address = s.member AND m.status = 'active')
      THEN s.member || ' is not an active member'
    WHEN EXISTS (
      SELECT FROM circle.seat o
      WHERE o.id <> s.id AND o.circle = s.circle AND o.member = s.member AND o.role IS NOT DISTINCT FROM s.role
        AND (o.until IS NULL OR o.until > cella.verdict_date())
    ) THEN s.member || ' already sits in ' || s.circle || coalesce(' as ' || s.role, '')
  END
  FROM (SELECT (payload ->> 'seat')::bigint AS seat, payload ->> 'motion' AS motion) p
  LEFT JOIN circle.seat s ON s.id = p.seat
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- circle:seat:remove — the seat ended on the verdict date, and
-- the cited motion ends it.
CREATE FUNCTION membership_motion.unseats(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.id IS NULL THEN 'no seat ' || coalesce(p.member, 'of no one') || ' holds in ' || coalesce(p.circle, 'no circle')
    WHEN s.until IS DISTINCT FROM cella.verdict_date() THEN 'seat ' || s.id || ' was not ended by this write'
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM membership_motion.seating g
      WHERE g.motion = d.id AND g.kind = 'unseat' AND g.circle = s.circle AND g.member = s.member AND g.role IS NOT DISTINCT FROM s.role
    ) THEN d.id || ' does not end ' || s.member || '''s seat in ' || s.circle
  END
  FROM (SELECT (payload ->> 'seat')::bigint AS seat, payload ->> 'circle' AS circle,
               payload ->> 'member' AS member, payload ->> 'motion' AS motion) p
  LEFT JOIN circle.seat s ON s.id = p.seat
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('circle:seat:add', 'membership_motion.seats(jsonb)', 'membership-motion'),
  ('circle:seat:remove', 'membership_motion.unseats(jsonb)', 'membership-motion');

GRANT SELECT ON membership_motion.seating TO cella_app, cella_guards;

-- circle:circle:create — the circle the write made is one the cited
-- motion creates, by its id, name and purpose, and its entry names the
-- default bundle in force on the verdict date (`circle.bundle`), the
-- mandates its members and its roles hold there from that day.
CREATE FUNCTION membership_motion.creates(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no circle ' || coalesce(p.circle, 'is named')
    WHEN c.assembly THEN c.id || ' is the assembly, which the founding makes'
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM motion.action m
      WHERE m.motion = d.id AND m.kind = 'circle' AND m.args ->> 'id' = c.id
        AND m.args ->> 'name' = c.name AND coalesce(m.args ->> 'purpose', '') = c.purpose
    ) THEN d.id || ' does not create ' || c.id || ' as ' || c.name
    WHEN p.bundle IS DISTINCT FROM to_jsonb(circle.bundle(cella.verdict_date()))
      THEN 'the creation of ' || c.id || ' names no bundle but the one in force on its verdict date'
  END
  FROM (SELECT payload ->> 'circle' AS circle, payload ->> 'motion' AS motion, payload -> 'bundle' AS bundle) p
  LEFT JOIN circle.circle c ON c.id = p.circle
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('circle:circle:create', 'membership_motion.creates(jsonb)', 'membership-motion');
