CREATE SCHEMA circle_decision;

-- What a decision may decide of the circles, registered with the decision
-- feat so its New form offers them: nesting a circle under another,
-- granting a power to a role, revoking a mandate. Amounts are in euros,
-- as the form asks for them; the writes carry them in cents.
INSERT INTO decision.kind (kind, label, fields, owner) VALUES
  ('nest', 'Nest a circle', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "parent", "label": "Under", "type": "text"}]', 'circle-decision'),
  ('grant', 'Grant a mandate', '[{"name": "role", "label": "Role", "type": "text"}, {"name": "power", "label": "Power", "type": "text"}, {"name": "text", "label": "Grants", "type": "text"}, {"name": "limit", "label": "Limit per write, €", "type": "number", "optional": true}, {"name": "budget", "label": "Budget, €", "type": "number", "optional": true}, {"name": "per", "label": "Budget per (month or year)", "type": "text", "optional": true}]', 'circle-decision'),
  ('revoke', 'Revoke a mandate', '[{"name": "mandate", "label": "Mandate", "type": "number"}]', 'circle-decision');

-- Which circle a motion is about: the circle nested, the role's circle,
-- the revoked mandate's role's circle. A role every working circle has
-- (`*`) is the assembly's to grant.
CREATE VIEW circle_decision.motion AS
SELECT m.decision, m.n, m.kind, m.args,
       CASE m.kind
         WHEN 'nest' THEN m.args ->> 'circle'
         WHEN 'grant' THEN (SELECT nullif(r.circle, '*') FROM circle.role r WHERE r.id = m.args ->> 'role')
         WHEN 'revoke' THEN (
           SELECT nullif(r.circle, '*') FROM circle.mandate x JOIN circle.role r ON r.id = x.role
           WHERE m.args ->> 'mandate' ~ '^[0-9]{1,18}$' AND x.id = (m.args ->> 'mandate')::bigint
         )
       END AS circle
FROM decision.motion m
WHERE m.kind IN ('nest', 'grant', 'revoke');

-- Whether a decision of the circle `decider` may decide about the circle
-- `subject`: the assembly decides about every circle, and a circle about
-- those strictly within it. A circle does not decide its own place or
-- powers; its parent does. With no circle named (`*`), the assembly alone.
CREATE FUNCTION circle_decision.decides(decider text, subject text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (SELECT FROM circle.circle b WHERE b.id = decides.decider AND b.parent IS NULL)
    OR (decides.decider IS DISTINCT FROM decides.subject AND circle.within(decides.subject, decides.decider));
END;

-- decision:decision:propose — each motion of this graft's kinds names
-- what it applies to, and the decision's circle may decide it: about the
-- circle nested, and the place it moves to; about the role's circle.
CREATE FUNCTION circle_decision.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN m.kind = 'nest' AND NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = m.args ->> 'circle')
        THEN 'no circle ' || coalesce(m.args ->> 'circle', 'is named') || ' to nest'
      WHEN m.kind = 'nest' AND NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = m.args ->> 'parent')
        THEN 'no circle ' || coalesce(m.args ->> 'parent', 'is named') || ' to nest under'
      WHEN m.kind = 'grant' AND NOT EXISTS (SELECT FROM circle.role r WHERE r.id = m.args ->> 'role')
        THEN 'no role ' || coalesce(m.args ->> 'role', 'is named')
      WHEN m.kind = 'grant' AND coalesce(m.args ->> 'power', '') !~ '^[a-z][a-z-]*$'
        THEN 'a power is named in lower case, such as approve-time'
      WHEN m.kind = 'grant' AND m.args ? 'limit' AND m.args ? 'budget'
        THEN 'a mandate caps by a limit per write or by a budget, not both'
      WHEN m.kind = 'grant' AND m.args ? 'budget' AND coalesce(m.args ->> 'per', '') NOT IN ('month', 'year')
        THEN 'a budget runs per month or per year'
      WHEN m.kind = 'revoke' AND NOT EXISTS (
        SELECT FROM circle.mandate x WHERE m.args ->> 'mandate' ~ '^[0-9]{1,18}$' AND x.id = (m.args ->> 'mandate')::bigint AND x.revoked IS NULL
      ) THEN 'no mandate in force ' || coalesce(m.args ->> 'mandate', 'is named')
      WHEN NOT circle_decision.decides(d.circle, coalesce(m.circle, '*'))
        OR (m.kind = 'nest' AND NOT circle_decision.decides(d.circle, m.args ->> 'parent') AND d.circle IS DISTINCT FROM m.args ->> 'parent')
        THEN d.circle || ' may not decide to ' || m.kind || ' in ' || coalesce(m.circle, 'every working circle')
    END AS r
    FROM circle_decision.motion m
    JOIN decision.decision d ON d.id = m.decision
    WHERE m.decision = payload ->> 'decision'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- circle:circle:nest — the cited decision nests this circle under this
-- parent.
CREATE FUNCTION circle_decision.nests(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM circle_decision.motion m
      WHERE m.decision = d.id AND m.kind = 'nest' AND m.args ->> 'circle' = p.circle AND m.args ->> 'parent' = p.parent
    ) THEN d.id || ' does not nest ' || coalesce(p.circle, 'a circle') || ' under ' || coalesce(p.parent, 'another')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'circle' AS circle, payload ->> 'parent' AS parent) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

-- circle:mandate:grant — the cited decision grants this power to this
-- role, capped as the payload caps it, its euros in cents.
CREATE FUNCTION circle_decision.grants(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM circle_decision.motion m
      WHERE m.decision = d.id AND m.kind = 'grant'
        AND m.args ->> 'role' = p.role AND m.args ->> 'power' = p.power
        AND round((m.args ->> 'limit')::numeric * 100) IS NOT DISTINCT FROM p."limit"
        AND round((m.args ->> 'budget')::numeric * 100) IS NOT DISTINCT FROM p.budget
        AND (m.args ->> 'per') IS NOT DISTINCT FROM p.per
    ) THEN d.id || ' does not grant ' || coalesce(p.power, 'this power') || ' to ' || coalesce(p.role, 'this role') || ' so capped'
  END
  FROM (
    SELECT payload ->> 'decision' AS decision, payload ->> 'role' AS role, payload ->> 'power' AS power,
           (payload ->> 'limit')::numeric AS "limit", (payload ->> 'budget')::numeric AS budget, payload ->> 'per' AS per
  ) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

-- circle:mandate:revoke — the cited decision revokes this mandate.
CREATE FUNCTION circle_decision.revokes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM circle_decision.motion m
      WHERE m.decision = d.id AND m.kind = 'revoke' AND m.args ->> 'mandate' = p.mandate
    ) THEN d.id || ' does not revoke mandate ' || coalesce(p.mandate, '?')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'mandate' AS mandate) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('decision:decision:propose', 'circle_decision.asks(jsonb)', 'circle-decision'),
  ('circle:circle:nest', 'circle_decision.nests(jsonb)', 'circle-decision'),
  ('circle:mandate:grant', 'circle_decision.grants(jsonb)', 'circle-decision'),
  ('circle:mandate:revoke', 'circle_decision.revokes(jsonb)', 'circle-decision');
INSERT INTO decision.cites (op, owner) VALUES
  ('circle:circle:nest', 'circle-decision'),
  ('circle:mandate:grant', 'circle-decision'),
  ('circle:mandate:revoke', 'circle-decision');

GRANT USAGE ON SCHEMA circle_decision TO cella_app, cella_guards;
GRANT SELECT ON circle_decision.motion TO cella_app, cella_guards;
