CREATE SCHEMA membership_motion;

-- What a motion may decide of a member, registered with the motion
-- feat so its New form offers them: admitting someone invited, with the
-- shares they subscribe; suspending a member; excluding a member.
SELECT motion.register_carries('admit', 'Admit a member', '[{"name": "member", "label": "Address", "type": "text"}, {"name": "shares", "label": "Shares", "type": "number"}]', 'membership:member:admit', 'membership-motion');
SELECT motion.register_carries('suspend', 'Suspend a member', '[{"name": "member", "label": "Address", "type": "text"}]', 'membership:member:suspend', 'membership-motion');
SELECT motion.register_carries('exclude', 'Exclude a member', '[{"name": "member", "label": "Address", "type": "text"}]', 'membership:member:exclude', 'membership-motion');

-- The actions of those kinds, each with the member it names and, for an
-- admission, the shares as a whole number or none. The motion is named
-- by id and the member by address, with no foreign key into either feat;
-- the guards resolve them.
CREATE VIEW membership_motion.action AS
SELECT m.motion, m.n, m.kind, m.args ->> 'member' AS member,
       CASE WHEN m.args ->> 'shares' ~ '^[0-9]{1,9}$' THEN (m.args ->> 'shares')::integer END AS shares
FROM motion.action m
WHERE m.kind IN ('admit', 'suspend', 'exclude');

-- motion:motion:propose — each action of this graft's kinds names a
-- member it can apply to: someone invited, with shares, to admit; an
-- active member to suspend; an active or suspended one to exclude.
CREATE FUNCTION membership_motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN m.member IS NULL THEN m.motion || ' names no member to ' || m.kind
      WHEN mm.address IS NULL THEN 'no member ' || m.member
      WHEN m.kind = 'admit' AND mm.status <> 'invited' THEN m.member || ' is ' || mm.status || ', not invited'
      WHEN m.kind = 'admit' AND coalesce(m.shares, 0) <= 0 THEN 'an admission subscribes a whole number of shares'
      WHEN m.kind = 'suspend' AND mm.status <> 'active' THEN m.member || ' is ' || mm.status || ', not active'
      WHEN m.kind = 'exclude' AND mm.status NOT IN ('active', 'suspended') THEN m.member || ' is ' || mm.status
    END AS r
    FROM membership_motion.action m
    LEFT JOIN membership.member mm ON mm.address = m.member
    WHERE m.motion = payload ->> 'motion'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- membership:member:admit — the cited motion asks to admit this member,
-- with these shares. That it closed and passed on its roll is
-- circle-membership-motion's guard, which this graft cannot read: an
-- admission cites a motion.
CREATE FUNCTION membership_motion.admits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM membership_motion.action m
      WHERE m.motion = d.id AND m.kind = 'admit' AND m.member = p.member AND m.shares = p.shares
    ) THEN d.id || ' does not admit ' || p.member || coalesce(' with ' || p.shares || ' shares', '')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'member' AS member, (payload ->> 'shares')::integer AS shares) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- membership:member:suspend, membership:member:exclude — the cited motion asks
-- this of this member.
CREATE FUNCTION membership_motion.ends(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM membership_motion.action m
      WHERE m.motion = d.id AND m.kind = split_part(cella.action(), ':', 3) AND m.member = p.member
    ) THEN d.id || ' does not ' || split_part(cella.action(), ':', 3) || ' ' || coalesce(p.member, 'anyone')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'member' AS member) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- motion:motion:close — every member the close admits, as its
-- payload's `admitted` names them, is one the motion asks to admit, and
-- the close left them admitted with the shares it asks (`membership.admitted`,
-- the membership feat's guard on a standalone admission, run here for each).
-- Whether the close admits everyone it must is circle-membership-motion's,
-- which can tell whether it passed.
CREATE FUNCTION membership_motion.closes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN m.member IS NULL THEN (payload ->> 'motion') || ' does not admit ' || a.member
      WHEN mm.shares IS DISTINCT FROM m.shares THEN a.member || ' holds ' || coalesce(mm.shares, 0) || ' shares, not ' || m.shares
      ELSE membership.admitted(jsonb_build_object('member', a.member))
    END AS r
    FROM jsonb_to_recordset(coalesce(payload -> 'admitted', '[]'::jsonb)) AS a(member text)
    LEFT JOIN membership_motion.action m ON m.motion = payload ->> 'motion' AND m.kind = 'admit' AND m.member = a.member
    LEFT JOIN membership.member mm ON mm.address = a.member
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'membership_motion.asks(jsonb)', 'membership-motion'),
  ('motion:motion:close', 'membership_motion.closes(jsonb)', 'membership-motion'),
  ('membership:member:admit', 'membership_motion.admits(jsonb)', 'membership-motion'),
  ('membership:member:suspend', 'membership_motion.ends(jsonb)', 'membership-motion'),
  ('membership:member:exclude', 'membership_motion.ends(jsonb)', 'membership-motion');
SELECT motion.register_cite('membership:member:admit', 'admit-member', 'membership-motion');
SELECT motion.register_cite('membership:member:suspend', 'suspend-member', 'membership-motion');
SELECT motion.register_cite('membership:member:exclude', 'exclude-member', 'membership-motion');

GRANT USAGE ON SCHEMA membership_motion TO cella_app, cella_guards;
GRANT SELECT ON membership_motion.action TO cella_app, cella_guards;
