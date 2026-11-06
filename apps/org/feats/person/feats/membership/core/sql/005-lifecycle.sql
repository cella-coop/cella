-- The days a membership moved: invited, applied, suspended and exited, beside
-- `since`, the day it was admitted; `applied` is the day an employee
-- asked to join by their right. A suspension lifted keeps its day
-- until the next. An exited member's `exit` says how they left: `withdrew`
-- by their own right or `excluded` by a motion, set by the write that
-- made them exited and none before.
ALTER TABLE membership.member
  ADD COLUMN invited date,
  ADD COLUMN applied date,
  ADD COLUMN suspended date,
  ADD COLUMN exited date,
  ADD COLUMN exit text CHECK (exit IN ('withdrew', 'excluded')),
  ADD CONSTRAINT exits CHECK (exit IS NULL OR status = 'exited');

-- membership:member:invite — the write invited a new member on the verdict
-- date, by an address no one holds.
CREATE FUNCTION membership.invites(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'no member ' || coalesce(p.address, 'is named')
    WHEN m.status <> 'invited' OR m.invited IS DISTINCT FROM cella.verdict_date()
      THEN m.address || ' was not invited by this write'
  END
  FROM (SELECT payload ->> 'member' AS address) p
  LEFT JOIN membership.member m ON m.address = p.address;
END;

-- membership:member:suspend, membership:member:exclude — the write left
-- the member suspended, or exited by exclusion, on the verdict date. That the cited
-- motion asks it is the membership-motion graft's guard on the same ops.
-- A carried one refused is forgone in the log with its reason, so the
-- reason names no one: the member's status and its day.
CREATE FUNCTION membership.ends(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN CASE WHEN p.address IS NULL THEN 'no member is named' ELSE 'the member named is not one of the co-op''s' END
    WHEN split_part(cella.action(), ':', 3) = 'suspend'
      AND (m.status <> 'suspended' OR m.suspended IS DISTINCT FROM cella.verdict_date())
      THEN 'this write suspended no one: the member is ' || m.status
        || coalesce(' since ' || to_char(CASE m.status WHEN 'suspended' THEN m.suspended WHEN 'exited' THEN m.exited END, 'YYYY-MM-DD'), '')
        || ', and only an active member is suspended'
    WHEN split_part(cella.action(), ':', 3) = 'exclude'
      AND (m.status <> 'exited' OR m.exited IS DISTINCT FROM cella.verdict_date() OR m.exit IS DISTINCT FROM 'excluded')
      THEN 'this write excluded no one: the member is ' || m.status
        || coalesce(' since ' || to_char(CASE m.status WHEN 'exited' THEN m.exited END, 'YYYY-MM-DD'), '')
        || ', and only an active or suspended member is excluded'
  END
  FROM (SELECT payload ->> 'member' AS address) p
  LEFT JOIN membership.member m ON m.address = p.address;
END;

-- membership:member:withdraw — a member leaves by their own right: the
-- membership is the actor's own, and the write left it exited on the
-- verdict date, by withdrawal. The lifecycle (`membership.moves`) lets only an active or
-- a suspended member exit, so no one withdraws who was not a member.
CREATE FUNCTION membership.withdraws(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.address IS DISTINCT FROM cella.actor()
      THEN cella.actor() || ' may not withdraw ' || coalesce(p.address, 'no one') || '''s membership: only their own'
    WHEN m.address IS NULL THEN 'no member ' || p.address
    WHEN m.status <> 'exited' OR m.exited IS DISTINCT FROM cella.verdict_date() OR m.exit IS DISTINCT FROM 'withdrew'
      THEN m.address || ' did not withdraw by this write'
  END
  FROM (SELECT payload ->> 'member' AS address) p
  LEFT JOIN membership.member m ON m.address = p.address;
END;

-- membership:member:apply — an employee asks to join by their own right:
-- the applicant is the actor, and the write left them invited, having
-- applied on the verdict date. One who is or was a member does not apply.
-- That they have worked a year is the employment-membership graft's
-- guard, and that the write put the motion to admit them,
-- membership-motion's.
CREATE FUNCTION membership.applies(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.address IS DISTINCT FROM cella.actor()
      THEN cella.actor() || ' may not apply for ' || coalesce(p.address, 'no one') || ': only for themselves'
    WHEN m.address IS NULL THEN 'no member ' || p.address
    WHEN m.status <> 'invited' THEN m.address || ' is ' || m.status || ': only someone not yet a member applies'
    WHEN m.applied IS DISTINCT FROM cella.verdict_date() THEN m.address || ' did not apply by this write'
  END
  FROM (SELECT payload ->> 'member' AS address) p
  LEFT JOIN membership.member m ON m.address = p.address;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('membership:member:invite', 'membership.invites(jsonb)', 'membership'),
  ('membership:member:apply', 'membership.applies(jsonb)', 'membership'),
  ('membership:member:suspend', 'membership.ends(jsonb)', 'membership'),
  ('membership:member:exclude', 'membership.ends(jsonb)', 'membership'),
  ('membership:member:withdraw', 'membership.withdraws(jsonb)', 'membership');
