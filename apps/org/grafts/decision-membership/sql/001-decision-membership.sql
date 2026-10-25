CREATE SCHEMA decision_membership;

-- What a decision may decide of a member, registered with the decision
-- feat so its New form offers them: admitting someone invited, with the
-- shares they subscribe; suspending a member; ending a membership.
INSERT INTO decision.kind (kind, label, fields, owner) VALUES
  ('admit', 'Admit a member', '[{"name": "member", "label": "Address", "type": "text"}, {"name": "shares", "label": "Shares", "type": "number"}]', 'decision-membership'),
  ('suspend', 'Suspend a member', '[{"name": "member", "label": "Address", "type": "text"}]', 'decision-membership'),
  ('exit', 'End a membership', '[{"name": "member", "label": "Address", "type": "text"}]', 'decision-membership');

-- The motions of those kinds, each with the member it names and, for an
-- admission, the shares as a whole number or none. The decision is named
-- by id and the member by address, with no foreign key into either feat;
-- the rules resolve them.
CREATE VIEW decision_membership.motion AS
SELECT m.decision, m.n, m.kind, m.args ->> 'member' AS member,
       CASE WHEN m.args ->> 'shares' ~ '^[0-9]{1,9}$' THEN (m.args ->> 'shares')::integer END AS shares
FROM decision.motion m
WHERE m.kind IN ('admit', 'suspend', 'exit');

-- decision:decision:propose — each motion of this graft's kinds names a
-- member it can apply to: someone invited, with shares, to admit; an
-- active member to suspend; an active or suspended one to exit.
CREATE FUNCTION decision_membership.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN m.member IS NULL THEN m.decision || ' names no member to ' || m.kind
      WHEN mm.address IS NULL THEN 'no member ' || m.member
      WHEN m.kind = 'admit' AND mm.status <> 'invited' THEN m.member || ' is ' || mm.status || ', not invited'
      WHEN m.kind = 'admit' AND coalesce(m.shares, 0) <= 0 THEN 'an admission subscribes a whole number of shares'
      WHEN m.kind = 'suspend' AND mm.status <> 'active' THEN m.member || ' is ' || mm.status || ', not active'
      WHEN m.kind = 'exit' AND mm.status NOT IN ('active', 'suspended') THEN m.member || ' is ' || mm.status
    END AS r
    FROM decision_membership.motion m
    LEFT JOIN membership.member mm ON mm.address = m.member
    WHERE m.decision = payload ->> 'decision'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- membership:member:admit — the cited decision asks to admit this member,
-- with these shares. That it closed and passed on its roll is
-- circle-decision-membership's rule, which this graft cannot read: an
-- admission cites a decision.
CREATE FUNCTION decision_membership.admits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM decision_membership.motion m
      WHERE m.decision = d.id AND m.kind = 'admit' AND m.member = p.member AND m.shares = p.shares
    ) THEN d.id || ' does not admit ' || p.member || coalesce(' with ' || p.shares || ' shares', '')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'member' AS member, (payload ->> 'shares')::integer AS shares) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

-- membership:member:suspend, membership:member:exit — the cited decision asks
-- this of this member.
CREATE FUNCTION decision_membership.ends(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM decision_membership.motion m
      WHERE m.decision = d.id AND m.kind = split_part(cella.op(), ':', 3) AND m.member = p.member
    ) THEN d.id || ' does not ' || split_part(cella.op(), ':', 3) || ' ' || coalesce(p.member, 'anyone')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'member' AS member) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

-- decision:decision:close — every member the close admits, as its
-- payload's `admitted` names them, is one the decision asks to admit, and
-- the close left them admitted with the shares it asks (`membership.admitted`,
-- the membership feat's rule on a standalone admission, run here for each).
-- Whether the close admits everyone it must is circle-decision-membership's,
-- which can tell whether it passed.
CREATE FUNCTION decision_membership.closes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN m.member IS NULL THEN (payload ->> 'decision') || ' does not admit ' || a.member
      WHEN mm.shares IS DISTINCT FROM m.shares THEN a.member || ' holds ' || coalesce(mm.shares, 0) || ' shares, not ' || m.shares
      ELSE membership.admitted(jsonb_build_object('member', a.member))
    END AS r
    FROM jsonb_to_recordset(coalesce(payload -> 'admitted', '[]'::jsonb)) AS a(member text)
    LEFT JOIN decision_membership.motion m ON m.decision = payload ->> 'decision' AND m.kind = 'admit' AND m.member = a.member
    LEFT JOIN membership.member mm ON mm.address = a.member
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('decision:decision:propose', 'decision_membership.asks(jsonb)', 'decision-membership'),
  ('decision:decision:close', 'decision_membership.closes(jsonb)', 'decision-membership'),
  ('membership:member:admit', 'decision_membership.admits(jsonb)', 'decision-membership'),
  ('membership:member:suspend', 'decision_membership.ends(jsonb)', 'decision-membership'),
  ('membership:member:exit', 'decision_membership.ends(jsonb)', 'decision-membership');
INSERT INTO decision.cites (op, owner) VALUES
  ('membership:member:admit', 'decision-membership'),
  ('membership:member:suspend', 'decision-membership'),
  ('membership:member:exit', 'decision-membership');

GRANT USAGE ON SCHEMA decision_membership TO cella_app, cella_rules;
GRANT SELECT ON decision_membership.motion TO cella_app, cella_rules;
