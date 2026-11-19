-- circle:seat:add and :remove cite a motion: the motion feat
-- attaches its own `carried` to them as it registers
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
    WHEN membership_motion.uncarried(payload ->> 'motion') THEN NULL
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
    WHEN membership_motion.uncarried(payload ->> 'motion') THEN NULL
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
    WHEN membership_motion.uncarried(payload ->> 'motion') THEN NULL
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
    WHEN membership_motion.uncarried(payload ->> 'motion') THEN NULL
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
    WHEN membership_motion.uncarried(payload ->> 'motion') THEN NULL
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
-- nothing else, a circle's features being arranged apart
-- (`arrange-features`); a name given is not blank and no other circle's;
-- a procedure given is one in force on the verdict date (`procedures`);
-- and it changes something of `was`, the circle's terms before it.
CREATE FUNCTION membership_motion.amend_terms(circle text, args jsonb, was jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL
      THEN 'no circle ' || coalesce(amend_terms.circle, 'is named') || ': a motion amends a circle there is, by its id'
    WHEN x.key = 'features'
      THEN 'an amendment of ' || c.id || ' changes its name, its purpose or its procedure, not its features: arrange them by an arrange-features action'
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
    WHERE k.key NOT IN ('circle', 'name', 'purpose', 'procedure') ORDER BY k.key = 'features' DESC, k.key LIMIT 1
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
RETURN (SELECT jsonb_build_object('name', c.name, 'purpose', c.purpose, 'procedure', c.procedure)
        FROM circle.circle c WHERE c.id = terms.circle);


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
-- motion amends, to the terms its entry carries and the circle now has, on the
-- terms `amend_terms` judges against what its entry says it was.
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

-- The coop's features a motion arranges, carried out by core's
-- circle:circle:arrange under the collective mandate `arrange-features`
-- over the root: the root's id and its layout, one listing in its order,
-- every feature under a group. And what a circle shows of it, one row an
-- action, each carried out by core's write of that row under the same
-- mandate over the circle: a group shown or not (`show-group`,
-- circle:circle:show), a feature hidden or not (`hide-feature`,
-- circle:circle:hide), each `yes` or `no`. Apart from `amend-circle`, so
-- a circle holding it over itself chooses what it shows.
SELECT motion.register_cite('circle:circle:arrange', 'arrange-features', 'membership-motion');
SELECT motion.register_cite('circle:circle:show', 'arrange-features', 'membership-motion');
SELECT motion.register_cite('circle:circle:hide', 'arrange-features', 'membership-motion');
SELECT motion.register_carries('arrange-features', 'Arrange the coop''s features', '[{"name": "circle", "label": "Root circle", "type": "text"}, {"name": "features", "label": "Features, in order, each under its group (Group: a, b; Other: c)", "type": "text"}]', 'circle:circle:arrange', 'membership-motion');
SELECT motion.register_carries('show-group', 'Show a group of features in a circle', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "group", "label": "Group", "type": "text"}, {"name": "shown", "label": "Shown (yes or no)", "type": "text"}]', 'circle:circle:show', 'membership-motion');
SELECT motion.register_carries('hide-feature', 'Hide a feature in a circle', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "feature", "label": "Feature", "type": "text"}, {"name": "hidden", "label": "Hidden (yes or no)", "type": "text"}]', 'circle:circle:hide', 'membership-motion');

-- Why a motion of `decider` may not arrange `subject`'s features, or
-- null: it holds no `arrange-features` whose scope covers the subject, and
-- the circle that does is named (`circle.arranger`). That it holds the
-- power at all is the motion feat's guard (`motion.empowers`); this is
-- the mandate's scope.
CREATE FUNCTION membership_motion.arrange_flaw(decider text, subject text) RETURNS text
LANGUAGE sql STABLE
RETURN CASE WHEN NOT circle.arranges(arrange_flaw.decider, arrange_flaw.subject, cella.verdict_date())
  THEN coalesce(arrange_flaw.decider, 'no circle') || ' holds arrange-features by no mandate covering ' || coalesce(arrange_flaw.subject, 'no circle')
    || coalesce(': put the arrangement to ' || circle.arranger(arrange_flaw.subject, cella.verdict_date()) || ', which holds it over ' || arrange_flaw.subject,
      ': no circle holds it over ' || coalesce(arrange_flaw.subject, 'none') || ', so a motion of the assembly granting one would allow it')
  END;

-- A row's `yes` or `no` as a motion gives it, or null for anything else.
CREATE FUNCTION membership_motion.yes(said text) RETURNS boolean
LANGUAGE sql IMMUTABLE
RETURN CASE lower(btrim(yes.said)) WHEN 'yes' THEN true WHEN 'no' THEN false END;

-- motion:motion:propose — the coop's features arranged are the motion of
-- a circle holding `arrange-features` over the root (`arrange_flaw`), and
-- a sound listing of them that changes something
-- (`circle.listing_flaw`), judged against the layout as it stands; a
-- circle's row shown or hidden, the motion of a circle holding it over
-- that circle, a sound row (`circle.row_flaw`), `yes` or `no`, that
-- changes what the circle shows. A motion carries each once: one
-- arranging the coop's features twice, or setting one row twice, is
-- refused, since its second action could only be forgone: a row by its
-- key, a group's by its circle and group, a feature's by its circle and
-- feature, the layout once a motion.
CREATE FUNCTION membership_motion.arrange_asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT coalesce(
      CASE WHEN EXISTS (
        SELECT FROM motion.action o
        WHERE o.motion = m.motion AND o.n < m.n AND o.kind = m.kind
          AND CASE m.kind
            WHEN 'show-group' THEN (o.args ->> 'circle', o.args ->> 'group') IS NOT DISTINCT FROM (m.args ->> 'circle', m.args ->> 'group')
            WHEN 'hide-feature' THEN (o.args ->> 'circle', o.args ->> 'feature') IS NOT DISTINCT FROM (m.args ->> 'circle', m.args ->> 'feature')
            ELSE true
          END
      ) THEN 'the motion ' || CASE m.kind WHEN 'arrange-features' THEN 'arranges the coop''s features'
          WHEN 'show-group' THEN 'sets whether ' || coalesce(m.args ->> 'circle', 'a circle') || ' shows ' || coalesce(m.args ->> 'group', 'a group')
          ELSE 'sets whether ' || coalesce(m.args ->> 'circle', 'a circle') || ' hides ' || coalesce(m.args ->> 'feature', 'a feature') END
        || ' twice: carry it once' END,
      CASE m.kind
      WHEN 'arrange-features' THEN coalesce(
        CASE WHEN NOT (m.args ? 'features') THEN 'the arrangement of ' || coalesce(m.args ->> 'circle', 'the coop') || ' gives no features: list them, or none' END,
        circle.listing_flaw(m.args ->> 'circle', m.args ->> 'features', circle.features(m.args ->> 'circle')),
        membership_motion.arrange_flaw(d.circle, m.args ->> 'circle'))
      WHEN 'show-group' THEN coalesce(
        circle.row_flaw(m.args ->> 'circle', m.args ->> 'group', NULL),
        CASE WHEN membership_motion.yes(m.args ->> 'shown') IS NULL
          THEN 'say whether ' || (m.args ->> 'circle') || ' shows ' || (m.args ->> 'group') || ': shown yes or no' END,
        CASE WHEN EXISTS (SELECT FROM circle.shown s WHERE s.circle = m.args ->> 'circle' AND s."group" = m.args ->> 'group') = membership_motion.yes(m.args ->> 'shown')
          THEN (m.args ->> 'circle') || CASE WHEN membership_motion.yes(m.args ->> 'shown') THEN ' shows ' ELSE ' does not show ' END
            || (m.args ->> 'group') || ' already: show or hide another group' END,
        membership_motion.arrange_flaw(d.circle, m.args ->> 'circle'))
      ELSE coalesce(
        circle.row_flaw(m.args ->> 'circle', NULL, coalesce(m.args ->> 'feature', '')),
        CASE WHEN membership_motion.yes(m.args ->> 'hidden') IS NULL
          THEN 'say whether ' || (m.args ->> 'circle') || ' hides ' || (m.args ->> 'feature') || ': hidden yes or no' END,
        CASE WHEN EXISTS (SELECT FROM circle.hidden h WHERE h.circle = m.args ->> 'circle' AND h.feat = m.args ->> 'feature') = membership_motion.yes(m.args ->> 'hidden')
          THEN (m.args ->> 'circle') || CASE WHEN membership_motion.yes(m.args ->> 'hidden') THEN ' hides ' ELSE ' does not hide ' END
            || (m.args ->> 'feature') || ' already: hide or show another feature' END,
        membership_motion.arrange_flaw(d.circle, m.args ->> 'circle'))
    END) AS r
    FROM motion.action m
    JOIN motion.motion d ON d.id = m.motion
    WHERE m.motion = payload ->> 'motion' AND m.kind IN ('arrange-features', 'show-group', 'hide-feature')
    ORDER BY m.n
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- circle:circle:arrange — the layout the write arranged is one the cited
-- motion arranges, to the listing its entry carries, compared as spelt;
-- the motion's circle holds `arrange-features` over the root still
-- (`arrange_flaw`). That the listing is sound and the coop has it is
-- core's guard (`circle.arranged`).
CREATE FUNCTION membership_motion.arranges(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(payload ->> 'motion', 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM motion.action m
      WHERE m.motion = d.id AND m.kind = 'arrange-features' AND m.args ->> 'circle' = payload ->> 'circle'
        AND circle.spelt(m.args ->> 'features') = circle.spelt(payload ->> 'features')
    )
      THEN d.id || ' does not arrange ' || coalesce(payload ->> 'circle', 'the coop') || '''s features as ' || coalesce(payload ->> 'features', 'none')
    ELSE membership_motion.arrange_flaw(d.circle, payload ->> 'circle')
  END
  FROM (SELECT) one
  LEFT JOIN motion.motion d ON d.id = payload ->> 'motion';
END;

-- circle:circle:show and circle:circle:hide — the row the write set is
-- one the cited motion sets so, and the motion's circle holds
-- `arrange-features` over the circle still (`arrange_flaw`). That the row
-- is sound and the circle has it is core's guard (`circle.showed`,
-- `circle.hid`).
CREATE FUNCTION membership_motion.shows(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(payload ->> 'motion', 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM motion.action m
      WHERE m.motion = d.id AND m.kind = 'show-group' AND m.args ->> 'circle' = payload ->> 'circle'
        AND m.args ->> 'group' = payload ->> 'group' AND membership_motion.yes(m.args ->> 'shown') = (payload ->> 'shown')::boolean
    )
      THEN d.id || ' does not set whether ' || coalesce(payload ->> 'circle', 'a circle') || ' shows ' || coalesce(payload ->> 'group', 'a group') || ' so'
    ELSE membership_motion.arrange_flaw(d.circle, payload ->> 'circle')
  END
  FROM (SELECT) one
  LEFT JOIN motion.motion d ON d.id = payload ->> 'motion';
END;

CREATE FUNCTION membership_motion.hides(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(payload ->> 'motion', 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM motion.action m
      WHERE m.motion = d.id AND m.kind = 'hide-feature' AND m.args ->> 'circle' = payload ->> 'circle'
        AND m.args ->> 'feature' = payload ->> 'feature' AND membership_motion.yes(m.args ->> 'hidden') = (payload ->> 'hidden')::boolean
    )
      THEN d.id || ' does not set whether ' || coalesce(payload ->> 'circle', 'a circle') || ' hides ' || coalesce(payload ->> 'feature', 'a feature') || ' so'
    ELSE membership_motion.arrange_flaw(d.circle, payload ->> 'circle')
  END
  FROM (SELECT) one
  LEFT JOIN motion.motion d ON d.id = payload ->> 'motion';
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'membership_motion.arrange_asks(jsonb)', 'membership-motion'),
  ('circle:circle:arrange', 'membership_motion.arranges(jsonb)', 'membership-motion'),
  ('circle:circle:show', 'membership_motion.shows(jsonb)', 'membership-motion'),
  ('circle:circle:hide', 'membership_motion.hides(jsonb)', 'membership-motion');

-- A role a motion makes, carried out by core's circle:role:make, and one
-- it changes, by core's circle:role:amend, both under the collective
-- mandate `amend-circle`: a new role's circle, `*` for every working
-- circle, its name, duty and cap, its id taken from the name at the
-- proposal; a role changed by its id, and any
-- of its new name, duty and cap. A later `seat` of the same motion may
-- name a role an earlier `role` action makes, by the id the proposal
-- gave it (`circle.role_key`).
SELECT motion.register_cite('circle:role:make', 'amend-circle', 'membership-motion');
SELECT motion.register_cite('circle:role:amend', 'amend-circle', 'membership-motion');
SELECT motion.register_carries('role', 'Make a role', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "name", "label": "Name", "type": "text"}, {"name": "duty", "label": "Duty", "type": "text", "optional": true}, {"name": "holders", "label": "Cap", "type": "number", "optional": true}]', 'circle:role:make', 'membership-motion');
SELECT motion.register_carries('amend-role', 'Change a role', '[{"name": "role", "label": "Role", "type": "text"}, {"name": "name", "label": "Name", "type": "text", "optional": true}, {"name": "duty", "label": "Duty", "type": "text", "optional": true}, {"name": "holders", "label": "Cap", "type": "number", "optional": true}]', 'circle:role:amend', 'membership-motion');

-- Why a role's name or cap, as `args` give them, would not do in
-- `circle`, the role `self` aside, or none: a name given is not blank
-- and no other role's in the circle, where a `*` role is in every one;
-- a cap is a whole count above none, and not below the tenures of the
-- role running on the verdict date in any circle it is held in, or none,
-- JSON's null, which lifts the role's.
CREATE FUNCTION membership_motion.duty_terms(self text, circle text, args jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN duty_terms.args ? 'name' AND coalesce(duty_terms.args ->> 'name', '') !~ '\S'
      THEN 'the ' || p.label || ' role is given a blank name: give it a name'
    WHEN o.id IS NOT NULL
      THEN 'the ' || o.id || ' role is named ' || o.name || ' already in ' || CASE o.circle WHEN '*' THEN 'every working circle' ELSE o.circle END
        || ': give the ' || p.label || ' role a name no other role of ' || CASE duty_terms.circle WHEN '*' THEN 'a working circle' ELSE duty_terms.circle END || ' has'
    WHEN duty_terms.args ? 'holders' AND jsonb_typeof(duty_terms.args -> 'holders') <> 'null' AND (p.cap IS NULL OR p.cap <> trunc(p.cap) OR p.cap <= 0)
      THEN (duty_terms.args ->> 'holders') || ' is no cap: give the ' || p.label || ' role a whole count of holders above none, or no cap'
    WHEN h.held > p.cap
      THEN 'the ' || p.label || ' role is held by ' || h.held || ' in ' || h.circle || ' on ' || to_char(cella.verdict_date(), 'YYYY-MM-DD')
        || ': give it a cap of ' || h.held || ' or more, or end a tenure of it first'
  END
  FROM (SELECT coalesce(duty_terms.self, CASE WHEN duty_terms.args ->> 'name' ~ '\S' THEN duty_terms.args ->> 'id' END, 'new') AS label,
               CASE WHEN jsonb_typeof(duty_terms.args -> 'holders') = 'number' THEN (duty_terms.args ->> 'holders')::numeric END AS cap) p
  LEFT JOIN LATERAL (
    SELECT y.id, y.name, y.circle FROM circle.role y
    WHERE y.id IS DISTINCT FROM duty_terms.self
      AND (duty_terms.circle = '*' OR y.circle IN (duty_terms.circle, '*'))
      AND lower(btrim(y.name)) = lower(btrim(duty_terms.args ->> 'name'))
    ORDER BY y.id
    LIMIT 1
  ) o ON true
  LEFT JOIN LATERAL (
    SELECT t.circle, count(*) AS held FROM circle.tenure t
    WHERE t.role = duty_terms.self
      AND coalesce(t.since, '-infinity') <= cella.verdict_date() AND coalesce(t.until, 'infinity') > cella.verdict_date()
    GROUP BY t.circle
    ORDER BY count(*) DESC, t.circle
    LIMIT 1
  ) h ON duty_terms.args ? 'holders';
END;

-- The terms of a role made, `args` as the motion carries them, judged at
-- the proposal and again as it is written, where `made` is the role the
-- write made, aside: it names a circle there is, or `*` for every working
-- circle, and nothing but its circle, id, name, duty and cap; it has a
-- name; at the proposal, its id is the one its name gives
-- (`circle.role_key`) past every circle and role there is and those the
-- motion's earlier actions make, `n` being its own, which the proposal
-- gives it, so no reader chooses it; and its name and cap do
-- (`duty_terms`). As it is written the make refuses an id taken since
-- (`circle.free`).
CREATE FUNCTION membership_motion.make_terms(motion text, n int, args jsonb, made text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(CASE
    WHEN p.circle IS DISTINCT FROM '*' AND c.id IS NULL
      THEN 'no circle ' || coalesce(p.circle, 'is named') || ': a role is made in a circle there is, by its id, or in every working circle, *'
    WHEN x.key IS NOT NULL
      THEN 'a role is made with its circle, name, duty and cap, not its ' || x.key
    WHEN NOT (make_terms.args ? 'name')
      THEN 'a role is made with no name: give it a name'
    WHEN make_terms.made IS NULL AND p.id IS DISTINCT FROM k.id
      THEN 'the role named ' || (make_terms.args ->> 'name') || ' takes the id ' || k.id || ' from its name, not ' || coalesce(p.id, 'none')
        || ': propose it by its name alone'
  END, membership_motion.duty_terms(make_terms.made, p.circle, make_terms.args))
  FROM (SELECT make_terms.args ->> 'circle' AS circle, make_terms.args ->> 'id' AS id) p
  LEFT JOIN circle.circle c ON c.id = p.circle
  LEFT JOIN LATERAL (
    SELECT k.key FROM jsonb_object_keys(make_terms.args) k(key)
    WHERE k.key NOT IN ('circle', 'id', 'name', 'duty', 'holders') ORDER BY k.key LIMIT 1
  ) x ON true
  CROSS JOIN LATERAL (
    SELECT circle.role_key(make_terms.args ->> 'name', ARRAY(
      SELECT o.args ->> 'id' FROM motion.action o
      WHERE o.motion = make_terms.motion AND o.n < make_terms.n AND o.kind IN ('circle', 'role') AND o.args ? 'id'
    )) AS id
  ) k;
END;

-- The terms of a role's amendment, `args` as the motion carries them,
-- judged at the proposal and again as it is written: the role is one
-- there is, and never `participant`, built in; it changes the name, the
-- duty or the cap, and nothing else; its name and cap do (`duty_terms`);
-- and it changes something of `was`, the role's terms before it.
CREATE FUNCTION membership_motion.remake_terms(role text, args jsonb, was jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(CASE
    WHEN r.id IS NULL
      THEN 'no role ' || coalesce(remake_terms.role, 'is named') || ': a motion amends a role there is, by its id'
    WHEN r.id = 'participant'
      THEN 'the participant role is built in, every seat''s in its circle, and never changed: amend another role'
    WHEN x.key IS NOT NULL
      THEN 'an amendment of the ' || r.id || ' role changes its name, its duty or its cap, not its ' || x.key
    WHEN NOT (remake_terms.args ?| ARRAY['name', 'duty', 'holders'])
      THEN 'the amendment of the ' || r.id || ' role gives no new name, duty or cap: give at least one'
  END, membership_motion.duty_terms(r.id, r.circle, remake_terms.args), CASE
    WHEN NOT EXISTS (
      SELECT FROM jsonb_each(remake_terms.args - 'role') a WHERE a.value IS DISTINCT FROM remake_terms.was -> a.key
    ) THEN 'the amendment of the ' || r.id || ' role changes nothing: it is named ' || r.name
      || ', capped at ' || coalesce(r.holders::text, 'no count') || ', with the duty it has already; give a term it does not have'
  END)
  FROM (SELECT remake_terms.role AS role) p
  LEFT JOIN circle.role r ON r.id = p.role
  LEFT JOIN LATERAL (
    SELECT k.key FROM jsonb_object_keys(remake_terms.args) k(key)
    WHERE k.key NOT IN ('role', 'name', 'duty', 'holders') ORDER BY k.key LIMIT 1
  ) x ON true;
END;

-- A role's terms as an amendment reads them, `was`.
CREATE FUNCTION membership_motion.duties(role text) RETURNS jsonb
LANGUAGE sql STABLE
RETURN (SELECT jsonb_build_object('name', r.name, 'duty', r.duty, 'holders', r.holders) FROM circle.role r WHERE r.id = duties.role);

-- motion:motion:propose — a role made or amended is the motion of a
-- circle that may decide about the role's circle (`motion.decides`), and
-- a `*` role, every working circle's, the assembly's alone; on the terms
-- `make_terms` and `remake_terms` judge against the role as it stands.
CREATE FUNCTION membership_motion.role_making_asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT coalesce(
      CASE m.kind
        WHEN 'role' THEN membership_motion.make_terms(m.motion, m.n, m.args, NULL)
        ELSE membership_motion.remake_terms(m.args ->> 'role', m.args, membership_motion.duties(m.args ->> 'role'))
      END,
      CASE WHEN NOT motion.decides(d.circle, w.circle) THEN
        CASE WHEN w.circle = '*'
          THEN 'a role of every working circle is the assembly''s alone: put the ' || coalesce(m.args ->> 'id', m.args ->> 'role') || ' role to it'
          ELSE d.circle || ' may not decide about ' || w.circle || ': put the ' || coalesce(m.args ->> 'id', m.args ->> 'role') || ' role to the assembly, or to another circle holding amend-circle'
        END
      END
    ) AS r
    FROM motion.action m
    JOIN motion.motion d ON d.id = m.motion
    CROSS JOIN LATERAL (
      SELECT CASE m.kind WHEN 'role' THEN m.args ->> 'circle' ELSE (SELECT x.circle FROM circle.role x WHERE x.id = m.args ->> 'role') END AS circle
    ) w
    WHERE m.motion = payload ->> 'motion' AND m.kind IN ('role', 'amend-role')
    ORDER BY m.n
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- circle:role:make — the role the write made is one the cited motion
-- makes, by its circle, id, name, duty and cap, on the terms
-- `make_terms` judges.
CREATE FUNCTION membership_motion.makes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN membership_motion.uncarried(p.motion) THEN NULL
    WHEN r.id IS NULL THEN 'no role ' || coalesce(p.role, 'is named') || ': a motion makes a role this write made'
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN m.n IS NULL
      THEN d.id || ' does not make the ' || r.id || ' role in ' || r.circle || ' as ' || r.name
    ELSE membership_motion.make_terms(d.id, m.n, m.args, r.id)
  END
  FROM (SELECT payload ->> 'role' AS role, payload ->> 'motion' AS motion) p
  LEFT JOIN circle.role r ON r.id = p.role
  LEFT JOIN motion.motion d ON d.id = p.motion
  LEFT JOIN LATERAL (
    SELECT o.n, o.args FROM motion.action o
    WHERE o.motion = d.id AND o.kind = 'role' AND o.args ->> 'id' = r.id AND o.args ->> 'circle' = r.circle
      AND o.args ->> 'name' = r.name AND coalesce(o.args ->> 'duty', '') = r.duty
      AND (o.args ->> 'holders')::int IS NOT DISTINCT FROM r.holders
    ORDER BY o.n
    LIMIT 1
  ) m ON true;
END;

-- circle:role:amend — the role the write changed is one the cited motion
-- amends, to the terms its entry carries and the role now has, on the
-- terms `remake_terms` judges against what its entry says it was.
CREATE FUNCTION membership_motion.remakes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN membership_motion.uncarried(p.motion) THEN NULL
    WHEN r.id IS NULL THEN 'no role ' || coalesce(p.role, 'is named') || ': a motion amends a role there is, by its id'
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM motion.action m
      WHERE m.motion = d.id AND m.kind = 'amend-role' AND m.args ->> 'role' = r.id
        AND (m.args - 'role') = p.terms
        AND NOT EXISTS (SELECT FROM jsonb_each(p.terms) t WHERE t.value IS DISTINCT FROM membership_motion.duties(r.id) -> t.key)
    ) THEN d.id || ' does not amend the ' || r.id || ' role to ' || p.terms::text
    ELSE membership_motion.remake_terms(r.id, p.terms, p.was)
  END
  FROM (SELECT payload ->> 'role' AS role, payload ->> 'motion' AS motion,
               payload - ARRAY['role', 'motion', 'was'] AS terms, payload -> 'was' AS was) p
  LEFT JOIN circle.role r ON r.id = p.role
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'membership_motion.role_making_asks(jsonb)', 'membership-motion'),
  ('circle:role:make', 'membership_motion.makes(jsonb)', 'membership-motion'),
  ('circle:role:amend', 'membership_motion.remakes(jsonb)', 'membership-motion');
