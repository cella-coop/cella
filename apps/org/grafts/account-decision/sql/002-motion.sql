-- Writes stay home: the adoption a decision asks for is its motion,
-- which the decision feat writes, so this graft reads it rather than
-- copying it by a trigger on `decision.motion`. That the motion names
-- terms not yet adopted is `asks`, the guard on the proposal.
DROP TRIGGER adopts_terms ON decision.motion;
DROP FUNCTION account_decision.moved();

ALTER TABLE account_decision.adoption RENAME TO recorded;

-- The decision of the members that adopts terms, as its motion names
-- them: one row a motion of the `terms` kind.
CREATE VIEW account_decision.adoption AS
SELECT m.args ->> 'terms' AS terms, m.decision
FROM decision.motion m
WHERE m.kind = 'terms';

-- decision:decision:propose — each motion to adopt terms names terms not
-- yet adopted.
CREATE OR REPLACE FUNCTION account_decision.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN t.id IS NULL THEN 'no terms ' || coalesce(m.args ->> 'terms', 'are named') || ' to adopt'
      WHEN t.adopted IS NOT NULL THEN t.id || ' were adopted on ' || to_char(t.adopted, 'YYYY-MM-DD')
    END AS r
    FROM decision.motion m
    LEFT JOIN account.terms t ON t.id = m.args ->> 'terms'
    WHERE m.decision = payload ->> 'decision' AND m.kind = 'terms'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- account:terms:adopt — the cited decision moved to adopt these terms.
CREATE OR REPLACE FUNCTION account_decision.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (SELECT FROM account_decision.adoption a WHERE a.terms = p.terms AND a.decision = d.id)
      THEN d.id || ' does not adopt ' || coalesce(p.terms, 'these terms')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'terms' AS terms) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

DROP TABLE account_decision.recorded;

GRANT SELECT ON account_decision.adoption TO cella_app, cella_guards;
