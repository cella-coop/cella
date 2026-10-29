-- Writes stay home: what a decision asks to adopt or approve is its
-- motion, which the decision feat writes, so this graft reads it rather
-- than copying it by a trigger on `decision.motion`. That the motion names
-- drafted terms or a drafted distribution is the rules on the proposal.
DROP TRIGGER adopts_patronage_terms ON decision.motion;
DROP TRIGGER approves_patronage_distribution ON decision.motion;
DROP FUNCTION decision_patronage.moved();
DROP FUNCTION decision_patronage.moved_to_approve();

ALTER TABLE decision_patronage.adoption RENAME TO recorded_adoption;
ALTER TABLE decision_patronage.approval RENAME TO recorded_approval;

-- The decision of the members that adopts terms, as its motion names
-- them: one row a motion of the `patronage` kind.
CREATE VIEW decision_patronage.adoption AS
SELECT m.args ->> 'terms' AS terms, m.decision
FROM decision.motion m
WHERE m.kind = 'patronage';

-- The decisions moving to approve a distribution: one row a motion of the
-- `distribution` kind. A draft moved again, after a decision that failed,
-- has a row for each; approving it cites one that passed.
CREATE VIEW decision_patronage.approval AS
SELECT m.args ->> 'distribution' AS distribution, m.decision
FROM decision.motion m
WHERE m.kind = 'distribution';

-- patronage:distribution:approve — the cited decision moved to approve
-- this distribution. That it closed and passed on its roll is
-- circle-decision-membership's rule, attached through decision.cites.
CREATE OR REPLACE FUNCTION decision_patronage.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (SELECT FROM decision_patronage.approval a WHERE a.distribution = p.distribution AND a.decision = d.id)
      THEN d.id || ' does not approve ' || coalesce(p.distribution, 'a distribution')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'distribution' AS distribution) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

-- decision:decision:propose — each motion to adopt terms names terms not
-- yet adopted.
CREATE OR REPLACE FUNCTION decision_patronage.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN t.id IS NULL THEN 'no terms ' || coalesce(m.args ->> 'terms', 'are named') || ' to adopt'
      WHEN t.adopted IS NOT NULL THEN t.id || ' were adopted on ' || to_char(t.adopted, 'YYYY-MM-DD')
    END AS r
    FROM decision.motion m
    LEFT JOIN patronage.terms t ON t.id = m.args ->> 'terms'
    WHERE m.decision = payload ->> 'decision' AND m.kind = 'patronage'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- patronage:terms:adopt — the cited decision moved to adopt these terms.
CREATE OR REPLACE FUNCTION decision_patronage.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (SELECT FROM decision_patronage.adoption a WHERE a.terms = p.terms AND a.decision = d.id)
      THEN d.id || ' does not adopt ' || coalesce(p.terms, 'these terms')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'terms' AS terms) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

-- decision:decision:propose — each motion to approve a distribution names
-- a draft not yet approved.
CREATE OR REPLACE FUNCTION decision_patronage.asks_to_approve(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN l.id IS NULL THEN 'no distribution ' || coalesce(m.args ->> 'distribution', 'is named') || ' to approve'
      WHEN l.approved IS NOT NULL THEN l.id || ' was approved on ' || to_char(l.approved, 'YYYY-MM-DD')
    END AS r
    FROM decision.motion m
    LEFT JOIN patronage.distribution l ON l.id = m.args ->> 'distribution'
    WHERE m.decision = payload ->> 'decision' AND m.kind = 'distribution'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

DROP TABLE decision_patronage.recorded_adoption;
DROP TABLE decision_patronage.recorded_approval;

GRANT SELECT ON decision_patronage.adoption, decision_patronage.approval TO cella_app, cella_rules;
