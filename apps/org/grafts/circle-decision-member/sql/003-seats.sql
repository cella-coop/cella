-- circle-member:position:add cites a decision: circle-decision-member's
-- `carried` attaches to it through decision.cites, as to every op listed.
INSERT INTO decision.cites (op, owner) VALUES ('circle-member:position:add', 'circle-decision-member');

-- circle-member:position:add — the seat is the one an admission gives: the
-- member the cited decision admits, active, seated from the verdict date
-- in the decision's circle, in its `member` role, where they held no such
-- seat before. Appointing to other roles by decision is not built.
CREATE FUNCTION circle_decision_member.seats(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.id IS NULL THEN 'no position ' || coalesce(p.position::text, 'is named')
    WHEN s.since IS DISTINCT FROM cella.verdict_date() OR s.until IS NOT NULL
      THEN 'position ' || s.id || ' was not added by this write'
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (SELECT FROM decision_member.admission a WHERE a.decision = d.id AND a.member = s.member)
      THEN d.id || ' does not admit ' || s.member
    WHEN NOT EXISTS (SELECT FROM member.member m WHERE m.address = s.member AND m.status = 'active')
      THEN s.member || ' is not an active member'
    WHEN s.circle <> d.circle OR s.role IS DISTINCT FROM 'member'
      THEN d.id || ' seats ' || s.member || ' in ' || d.circle || ' as member, not in ' || s.circle || ' as ' || coalesce(s.role, 'no role')
    WHEN EXISTS (
      SELECT FROM circle_member.position o
      WHERE o.id <> s.id AND o.circle = s.circle AND o.member = s.member AND o.role = s.role
        AND (o.until IS NULL OR o.until > cella.verdict_date())
    ) THEN s.member || ' already sits in ' || s.circle || ' as member'
  END
  FROM (SELECT (payload ->> 'position')::bigint AS position, payload ->> 'decision' AS decision) p
  LEFT JOIN circle_member.position s ON s.id = p.position
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('circle-member:position:add', 'circle_decision_member.seats(jsonb)', 'circle-decision-member');
