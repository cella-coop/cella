-- circle-member:position:add and :remove cite a decision:
-- circle-decision-member's `carried` attaches to them through
-- decision.cites, as to every op listed.
INSERT INTO decision.cites (op, owner) VALUES
  ('circle-member:position:add', 'circle-decision-member'),
  ('circle-member:position:remove', 'circle-decision-member');

-- What a decision may decide of seats, registered with the decision feat
-- so its New form offers them: seating a member in a circle, in one of
-- its roles or as a plain member, and ending such a seat.
INSERT INTO decision.kind (kind, label, fields, owner) VALUES
  ('seat', 'Seat a member', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "member", "label": "Address", "type": "text"}, {"name": "role", "label": "Role", "type": "text", "optional": true}]', 'circle-decision-member'),
  ('unseat', 'End a seat', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "member", "label": "Address", "type": "text"}, {"name": "role", "label": "Role", "type": "text", "optional": true}]', 'circle-decision-member');

-- The seats decisions give and end: an admission seats the member in the
-- decision's circle as `member`; a `seat` or `unseat` motion names its
-- circle, member and role, none for a plain seat.
CREATE VIEW circle_decision_member.seating AS
SELECT m.decision, m.n, m.kind, m.args ->> 'circle' AS circle, m.args ->> 'member' AS member, m.args ->> 'role' AS role
FROM decision.motion m
WHERE m.kind IN ('seat', 'unseat')
UNION ALL
SELECT a.decision, a.n, 'seat', d.circle, a.member, 'member'
FROM decision_member.motion a
JOIN decision.decision d ON d.id = a.decision
WHERE a.kind = 'admit';

-- circle-member:position:add — the seat is one the cited decision gives,
-- to an active member, from the verdict date, where they held no such
-- seat before.
CREATE FUNCTION circle_decision_member.seats(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.id IS NULL THEN 'no position ' || coalesce(p.position::text, 'is named')
    WHEN s.since IS DISTINCT FROM cella.verdict_date() OR s.until IS NOT NULL
      THEN 'position ' || s.id || ' was not added by this write'
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM circle_decision_member.seating g
      WHERE g.decision = d.id AND g.kind = 'seat' AND g.circle = s.circle AND g.member = s.member AND g.role IS NOT DISTINCT FROM s.role
    ) THEN d.id || ' does not seat ' || s.member || ' in ' || s.circle || coalesce(' as ' || s.role, '')
    WHEN NOT EXISTS (SELECT FROM member.member m WHERE m.address = s.member AND m.status = 'active')
      THEN s.member || ' is not an active member'
    WHEN EXISTS (
      SELECT FROM circle_member.position o
      WHERE o.id <> s.id AND o.circle = s.circle AND o.member = s.member AND o.role IS NOT DISTINCT FROM s.role
        AND (o.until IS NULL OR o.until > cella.verdict_date())
    ) THEN s.member || ' already sits in ' || s.circle || coalesce(' as ' || s.role, '')
  END
  FROM (SELECT (payload ->> 'position')::bigint AS position, payload ->> 'decision' AS decision) p
  LEFT JOIN circle_member.position s ON s.id = p.position
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

-- circle-member:position:remove — the seat ended on the verdict date, and
-- the cited decision ends it.
CREATE FUNCTION circle_decision_member.unseats(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.id IS NULL THEN 'no seat ' || coalesce(p.member, 'of no one') || ' holds in ' || coalesce(p.circle, 'no circle')
    WHEN s.until IS DISTINCT FROM cella.verdict_date() THEN 'position ' || s.id || ' was not ended by this write'
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM circle_decision_member.seating g
      WHERE g.decision = d.id AND g.kind = 'unseat' AND g.circle = s.circle AND g.member = s.member AND g.role IS NOT DISTINCT FROM s.role
    ) THEN d.id || ' does not end ' || s.member || '''s seat in ' || s.circle
  END
  FROM (SELECT (payload ->> 'position')::bigint AS position, payload ->> 'circle' AS circle,
               payload ->> 'member' AS member, payload ->> 'decision' AS decision) p
  LEFT JOIN circle_member.position s ON s.id = p.position
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('circle-member:position:add', 'circle_decision_member.seats(jsonb)', 'circle-decision-member'),
  ('circle-member:position:remove', 'circle_decision_member.unseats(jsonb)', 'circle-decision-member');

GRANT SELECT ON circle_decision_member.seating TO cella_app, cella_rules;
