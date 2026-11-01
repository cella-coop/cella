-- Who is an active member is membership's to say, on a day
-- (`membership.active`): who puts, closes and deliberates on a decision,
-- who is seated by one, who gives a stance, who counts while it is open
-- and who is counted at its close read it on the verdict date, not a copy
-- of the member's status.
CREATE OR REPLACE FUNCTION circle_decision_membership.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is named')
    WHEN NOT EXISTS (SELECT FROM circle_membership.seated(d.circle, cella.verdict_date()) s WHERE s = cella.actor())
      OR NOT membership.active(cella.actor(), cella.verdict_date())
      THEN cella.actor() || ' holds no seat in ' || d.circle || ', so may not ' || split_part(cella.action(), ':', 3) || ' ' || d.id
  END
  FROM (SELECT payload ->> 'decision' AS decision) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

CREATE OR REPLACE FUNCTION circle_decision_membership.seats(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.id IS NULL THEN 'no position ' || coalesce(p.position::text, 'is named')
    WHEN s.since IS DISTINCT FROM cella.verdict_date() OR s.until IS NOT NULL
      THEN 'position ' || s.id || ' was not added by this write'
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM circle_decision_membership.seating g
      WHERE g.decision = d.id AND g.kind = 'seat' AND g.circle = s.circle AND g.member = s.member AND g.role IS NOT DISTINCT FROM s.role
    ) THEN d.id || ' does not seat ' || s.member || ' in ' || s.circle || coalesce(' as ' || s.role, '')
    WHEN NOT membership.active(s.member, cella.verdict_date())
      THEN s.member || ' is not an active member'
    WHEN EXISTS (
      SELECT FROM circle_membership.position o
      WHERE o.id <> s.id AND o.circle = s.circle AND o.member = s.member AND o.role IS NOT DISTINCT FROM s.role
        AND (o.until IS NULL OR o.until > cella.verdict_date())
    ) THEN s.member || ' already sits in ' || s.circle || coalesce(' as ' || s.role, '')
  END
  FROM (SELECT (payload ->> 'position')::bigint AS position, payload ->> 'decision' AS decision) p
  LEFT JOIN circle_membership.position s ON s.id = p.position
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

CREATE OR REPLACE FUNCTION circle_decision_membership.on_roll(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT FROM circle_decision_membership.roll r WHERE r.decision = p.decision AND r.member = p.member
    ) THEN coalesce(p.member, 'no one') || ' is not on the roll of ' || coalesce(p.decision, 'no decision')
    WHEN NOT membership.active(p.member, cella.verdict_date())
      THEN p.member || ' is not an active member'
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'member' AS member) p;
END;

CREATE OR REPLACE FUNCTION circle_decision_membership.asks(payload jsonb) RETURNS text
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
      WHEN g.kind = 'seat' AND NOT membership.active(g.member, cella.verdict_date())
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

CREATE OR REPLACE FUNCTION circle_decision_membership.electorate(ref text) RETURNS SETOF text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT c.member
  FROM circle_decision_membership.counted c
  JOIN decision.decision d ON d.id = c.decision AND d.closed IS NOT NULL
  WHERE c.decision = ref
  UNION
  SELECT r.member
  FROM circle_decision_membership.roll r
  JOIN decision.decision d ON d.id = r.decision AND d.closed IS NULL
  WHERE r.decision = ref AND membership.active(r.member, cella.verdict_date());
END;

CREATE OR REPLACE FUNCTION circle_decision_membership.count_roll() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO circle_decision_membership.counted (decision, member)
  SELECT r.decision, r.member
  FROM circle_decision_membership.roll r
  WHERE r.decision = NEW.id AND membership.active(r.member, cella.verdict_date());
  RETURN NULL;
END
$$;
