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

-- circle:role:seat and :unseat cite a motion with the same power: a role
-- made a member of another circle, so whoever holds it sits there, and
-- that seat ended, every tenure of the role standing. What a motion may
-- decide of them, registered so its New form offers them: the circle and
-- the role.
SELECT motion.register_cite('circle:role:seat', 'seat-member', 'membership-motion');
SELECT motion.register_cite('circle:role:unseat', 'seat-member', 'membership-motion');
SELECT motion.register_carries('seat-role', 'Seat a role in a circle', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "role", "label": "Role", "type": "text"}]', 'circle:role:seat', 'membership-motion');
SELECT motion.register_carries('unseat-role', 'End a role''s seat', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "role", "label": "Role", "type": "text"}]', 'circle:role:unseat', 'membership-motion');

-- The terms of a role's seat in a circle, judged at the proposal and
-- again as the seat is written: the circle is one there is, or `made`, one
-- an earlier action of the same motion creates; the role is one there is;
-- a seat is never in the role's own circle, where its holders sit by
-- their tenures, and a role sits in a circle once, the seat `seat`, the
-- one being written, aside; an unseat names a seat the role holds there.
CREATE FUNCTION membership_motion.role_terms(kind text, circle text, role text, made boolean, seat bigint) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL AND NOT role_terms.made
      THEN 'no circle ' || coalesce(role_terms.circle, 'is named') || ': a role is seated in a circle there is'
    WHEN r.id IS NULL
      THEN 'no role ' || coalesce(role_terms.role, 'is named') || ': a role is seated by the id of one there is'
    WHEN role_terms.kind = 'seat-role' AND r.circle = role_terms.circle
      THEN 'the ' || r.id || ' role is ' || r.circle || '''s own, where its holders sit by their tenures: seat it in another circle'
    WHEN role_terms.kind = 'seat-role' AND o.id IS NOT NULL
      THEN 'the ' || r.id || ' role sits in ' || role_terms.circle || ' already'
        || coalesce(', since ' || to_char(o.since, 'YYYY-MM-DD'), '') || ': a role sits in a circle once, so end that seat first'
    WHEN role_terms.kind = 'unseat-role' AND o.id IS NULL
      THEN 'the ' || r.id || ' role holds no seat in ' || role_terms.circle || ' to end'
  END
  FROM (SELECT role_terms.circle AS circle, role_terms.role AS role) p
  LEFT JOIN circle.circle c ON c.id = p.circle
  LEFT JOIN circle.role r ON r.id = p.role
  LEFT JOIN LATERAL (
    SELECT m.id, m.since FROM circle.member m
    WHERE m.circle = p.circle AND m.role = p.role AND m.id IS DISTINCT FROM role_terms.seat
      AND (m.until IS NULL OR m.until > cella.verdict_date())
    ORDER BY m.id
    LIMIT 1
  ) o ON true;
END;

-- motion:motion:propose — a role seated in a circle or unseated is the
-- motion of a circle that may decide who sits there (`motion.decides`),
-- on the terms `role_terms` judges.
CREATE FUNCTION membership_motion.role_asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT coalesce(
      membership_motion.role_terms(g.kind, g.circle, g.role, g.made, NULL),
      CASE WHEN NOT g.made AND NOT motion.decides(d.circle, g.circle)
        THEN d.circle || ' may not decide who sits in ' || g.circle END
    ) AS r
    FROM (
      SELECT m.motion, m.n, m.kind, m.args ->> 'circle' AS circle, m.args ->> 'role' AS role,
             EXISTS (
               SELECT FROM motion.action o
               WHERE o.motion = m.motion AND o.n < m.n AND o.kind = 'circle' AND o.args ->> 'id' = m.args ->> 'circle'
             ) AS made
      FROM motion.action m
      WHERE m.motion = payload ->> 'motion' AND m.kind IN ('seat-role', 'unseat-role')
    ) g
    JOIN motion.motion d ON d.id = g.motion
    ORDER BY g.n
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- circle:role:seat — the seat is a role's membership this write added
-- from the verdict date, which the cited motion gives, on its terms.
CREATE FUNCTION membership_motion.seats_role(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.id IS NULL OR s.role IS NULL THEN 'no seat of a role ' || coalesce(p.seat::text, 'is named')
    WHEN s.since IS DISTINCT FROM cella.verdict_date() OR s.until IS NOT NULL
      THEN 'seat ' || s.id || ' was not added by this write'
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM motion.action m
      WHERE m.motion = d.id AND m.kind = 'seat-role' AND m.args ->> 'circle' = s.circle AND m.args ->> 'role' = s.role
    ) THEN d.id || ' does not seat the ' || s.role || ' role in ' || s.circle
    ELSE membership_motion.role_terms('seat-role', s.circle, s.role, false, s.id)
  END
  FROM (SELECT (payload ->> 'seat')::bigint AS seat, payload ->> 'motion' AS motion) p
  LEFT JOIN circle.member s ON s.id = p.seat
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- circle:role:unseat — the role's seat ended on the verdict date, and the
-- cited motion ends it.
CREATE FUNCTION membership_motion.unseats_role(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.id IS NULL OR s.role IS NULL
      THEN 'the ' || coalesce(p.role, 'no') || ' role holds no seat in ' || coalesce(p.circle, 'no circle') || ' to end'
    WHEN s.until IS DISTINCT FROM cella.verdict_date() THEN 'seat ' || s.id || ' was not ended by this write'
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM motion.action m
      WHERE m.motion = d.id AND m.kind = 'unseat-role' AND m.args ->> 'circle' = s.circle AND m.args ->> 'role' = s.role
    ) THEN d.id || ' does not end the ' || s.role || ' role''s seat in ' || s.circle
  END
  FROM (SELECT (payload ->> 'seat')::bigint AS seat, payload ->> 'circle' AS circle,
               payload ->> 'role' AS role, payload ->> 'motion' AS motion) p
  LEFT JOIN circle.member s ON s.id = p.seat
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'membership_motion.role_asks(jsonb)', 'membership-motion'),
  ('circle:role:seat', 'membership_motion.seats_role(jsonb)', 'membership-motion'),
  ('circle:role:unseat', 'membership_motion.unseats_role(jsonb)', 'membership-motion');

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

-- A circle a motion amends, carried out by core's circle:circle:amend
-- under the collective mandate `amend-circle`: its id, and any of its new
-- name, purpose and procedure.
SELECT motion.register_cite('circle:circle:amend', 'amend-circle', 'membership-motion');
SELECT motion.register_carries('amend-circle', 'Change a circle', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "name", "label": "Name", "type": "text", "optional": true}, {"name": "purpose", "label": "Purpose", "type": "text", "optional": true}, {"name": "procedure", "label": "Procedure", "type": "text", "optional": true}]', 'circle:circle:amend', 'membership-motion');

-- The procedures a circle may decide by on `day`: those built in, and
-- those a procedure policy in force that day makes.
CREATE FUNCTION membership_motion.procedures(day date) RETURNS SETOF text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT o.id
  FROM motion.procedure o
  LEFT JOIN policy.policy r ON r.id = o.policy
  WHERE o.policy IS NULL OR (r.applies <= procedures.day AND (r.ends IS NULL OR r.ends > procedures.day))
  ORDER BY o.id;
END;

-- The terms of a circle's amendment, `args` as the motion carries them,
-- judged at the proposal and again as it is written: the circle is one
-- there is; it changes the name, the purpose or the procedure, and
-- nothing else; a name given is not blank and no other circle's; a
-- procedure given is one in force on the verdict date (`procedures`);
-- and it changes something of `was`, the circle's terms before it.
CREATE FUNCTION membership_motion.amend_terms(circle text, args jsonb, was jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL
      THEN 'no circle ' || coalesce(amend_terms.circle, 'is named') || ': a motion amends a circle there is, by its id'
    WHEN x.key IS NOT NULL
      THEN 'an amendment of ' || c.id || ' changes its name, its purpose or its procedure, not its ' || x.key
    WHEN NOT (amend_terms.args ?| ARRAY['name', 'purpose', 'procedure'])
      THEN 'the amendment of ' || c.id || ' gives no new name, purpose or procedure: give at least one'
    WHEN amend_terms.args ? 'name' AND coalesce(amend_terms.args ->> 'name', '') !~ '\S'
      THEN 'the amendment of ' || c.id || ' gives it a blank name: give it a name'
    WHEN o.id IS NOT NULL
      THEN o.id || ' is named ' || o.name || ' already: give ' || c.id || ' a name no other circle has'
    WHEN amend_terms.args ? 'procedure' AND (amend_terms.args ->> 'procedure') NOT IN (SELECT membership_motion.procedures(cella.verdict_date()))
      THEN coalesce(amend_terms.args ->> 'procedure', 'none') || ' is no procedure in force on ' || to_char(cella.verdict_date(), 'YYYY-MM-DD')
        || ': give ' || c.id || ' one of ' || (SELECT string_agg(q, ', ') FROM membership_motion.procedures(cella.verdict_date()) q)
    WHEN NOT EXISTS (
      SELECT FROM jsonb_each(amend_terms.args - 'circle') a WHERE a.value IS DISTINCT FROM amend_terms.was -> a.key
    ) THEN 'the amendment of ' || c.id || ' changes nothing: it is named ' || c.name || ', for ' || coalesce(nullif(c.purpose, ''), 'no purpose')
      || ', deciding by ' || c.procedure || ' already; give a term it does not have'
  END
  FROM (SELECT amend_terms.circle AS circle) p
  LEFT JOIN circle.circle c ON c.id = p.circle
  LEFT JOIN LATERAL (
    SELECT k.key FROM jsonb_object_keys(amend_terms.args) k(key)
    WHERE k.key NOT IN ('circle', 'name', 'purpose', 'procedure') ORDER BY k.key LIMIT 1
  ) x ON true
  LEFT JOIN LATERAL (
    SELECT y.id, y.name FROM circle.circle y
    WHERE y.id <> p.circle AND lower(btrim(y.name)) = lower(btrim(amend_terms.args ->> 'name'))
    ORDER BY y.id
    LIMIT 1
  ) o ON true;
END;

-- A circle's terms as an amendment reads them, `was`.
CREATE FUNCTION membership_motion.terms(circle text) RETURNS jsonb
LANGUAGE sql STABLE
RETURN (SELECT jsonb_build_object('name', c.name, 'purpose', c.purpose, 'procedure', c.procedure) FROM circle.circle c WHERE c.id = terms.circle);

-- motion:motion:propose — a circle amended is the motion of a circle
-- that may decide about it (`motion.decides`), on the terms
-- `amend_terms` judges against the circle as it stands.
CREATE FUNCTION membership_motion.amend_asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT coalesce(
      membership_motion.amend_terms(m.args ->> 'circle', m.args, membership_motion.terms(m.args ->> 'circle')),
      CASE WHEN NOT motion.decides(d.circle, m.args ->> 'circle')
        THEN d.circle || ' may not decide about ' || (m.args ->> 'circle') || ': put its amendment to the assembly, or to another circle holding amend-circle' END
    ) AS r
    FROM motion.action m
    JOIN motion.motion d ON d.id = m.motion
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'amend-circle'
    ORDER BY m.n
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- circle:circle:amend — the circle the write changed is one the cited
-- motion amends, to the terms its entry carries and the circle now has,
-- on the terms `amend_terms` judges against what its entry says it was.
CREATE FUNCTION membership_motion.amends(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no circle ' || coalesce(p.circle, 'is named') || ': a motion amends a circle there is, by its id'
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM motion.action m
      WHERE m.motion = d.id AND m.kind = 'amend-circle' AND m.args ->> 'circle' = c.id
        AND (m.args - 'circle') = p.terms
        AND NOT EXISTS (SELECT FROM jsonb_each(p.terms) t WHERE t.value IS DISTINCT FROM membership_motion.terms(c.id) -> t.key)
    ) THEN d.id || ' does not amend ' || c.id || ' to ' || p.terms::text
    ELSE membership_motion.amend_terms(c.id, p.terms, p.was)
  END
  FROM (SELECT payload ->> 'circle' AS circle, payload ->> 'motion' AS motion,
               payload - ARRAY['circle', 'motion', 'was'] AS terms, payload -> 'was' AS was) p
  LEFT JOIN circle.circle c ON c.id = p.circle
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'membership_motion.amend_asks(jsonb)', 'membership-motion'),
  ('circle:circle:amend', 'membership_motion.amends(jsonb)', 'membership-motion');
