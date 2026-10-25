-- decision:decision:vote — the member is on the decision's roll, and
-- active: a suspended or exited member gives no stance, as their stance
-- would not be counted.
CREATE OR REPLACE FUNCTION circle_decision_membership.on_roll(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT FROM circle_decision_membership.roll r WHERE r.decision = p.decision AND r.member = p.member
    ) THEN coalesce(p.member, 'no one') || ' is not on the roll of ' || coalesce(p.decision, 'no decision')
    WHEN NOT EXISTS (SELECT FROM membership.member m WHERE m.address = p.member AND m.status = 'active')
      THEN p.member || ' is not an active member'
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'member' AS member) p;
END;

-- decision:decision:propose — who decides what of members and seats:
-- the assembly alone admits, suspends and lets members go; a seat is the
-- decision of the circle above it, or of the assembly, and names an
-- active member for a role of that circle; ending one names a seat held.
CREATE FUNCTION circle_decision_membership.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = d.circle AND c.parent IS NULL)
        THEN 'only the assembly decides to ' || a.kind || ' a member, not ' || d.circle
    END AS r
    FROM decision_membership.motion a JOIN decision.decision d ON d.id = a.decision
    WHERE a.decision = payload ->> 'decision'
    UNION ALL
    SELECT CASE
      WHEN NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = g.circle) THEN 'no circle ' || coalesce(g.circle, 'is named')
      WHEN g.kind = 'seat' AND NOT EXISTS (SELECT FROM membership.member m WHERE m.address = g.member AND m.status = 'active')
        THEN coalesce(g.member, 'no one') || ' is not an active member'
      WHEN g.kind = 'seat' AND g.role IS NOT NULL
        AND NOT EXISTS (SELECT FROM circle.role x WHERE x.id = g.role AND x.circle IN (g.circle, '*'))
        THEN 'no role ' || g.role || ' in ' || g.circle
      WHEN g.kind = 'unseat' AND NOT EXISTS (
        SELECT FROM circle_membership.position o
        WHERE o.circle = g.circle AND o.member = g.member AND o.role IS NOT DISTINCT FROM g.role AND o.until IS NULL
      ) THEN coalesce(g.member, 'no one') || ' holds no such seat in ' || g.circle
      WHEN NOT circle_decision.decides(d.circle, g.circle)
        THEN d.circle || ' may not decide who sits in ' || g.circle
    END
    FROM (
      SELECT m.decision, m.kind, m.args ->> 'circle' AS circle, m.args ->> 'member' AS member, m.args ->> 'role' AS role
      FROM decision.motion m
      WHERE m.decision = payload ->> 'decision' AND m.kind IN ('seat', 'unseat')
    ) g
    JOIN decision.decision d ON d.id = g.decision
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- decision:decision:close — a passing close admits, in its own
-- transaction, everyone the decision admits, and seats each in the
-- decision's circle as `member` (`seats`, as on a seat of its own); a
-- close that does not pass admits no one. Its payload's `admitted` names
-- each member and their seat. That each admission is one the decision
-- asks, with its shares, is decision-membership's rule on the close.
CREATE FUNCTION circle_decision_membership.settles(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL OR d.closed IS NULL THEN NULL
    WHEN coalesce(circle_decision_membership.passes(d.id), false) THEN (
      SELECT r FROM (
        SELECT CASE
          WHEN a.member IS NULL THEN d.id || ' passes, and its close does not admit ' || m.member
          ELSE circle_decision_membership.seats(jsonb_build_object('position', a.position, 'decision', d.id))
        END AS r
        FROM decision_membership.motion m
        LEFT JOIN jsonb_to_recordset(coalesce(payload -> 'admitted', '[]'::jsonb)) AS a(member text, position bigint)
          ON a.member = m.member
        WHERE m.decision = d.id AND m.kind = 'admit'
      ) x
      WHERE r IS NOT NULL
      LIMIT 1
    )
    WHEN jsonb_array_length(coalesce(payload -> 'admitted', '[]'::jsonb)) > 0
      THEN d.id || ' does not pass, so its close admits no one'
  END
  FROM (SELECT payload ->> 'decision' AS id) p
  LEFT JOIN decision.decision d ON d.id = p.id;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('decision:decision:propose', 'circle_decision_membership.asks(jsonb)', 'circle-decision-membership'),
  ('decision:decision:close', 'circle_decision_membership.settles(jsonb)', 'circle-decision-membership');
