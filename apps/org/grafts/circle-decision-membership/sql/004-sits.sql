-- decision:decision:propose, decision:decision:close — the actor is an
-- active member seated in the decision's circle on the verdict date: a
-- circle's members put its decisions and close them.
CREATE FUNCTION circle_decision_membership.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is named')
    WHEN NOT EXISTS (SELECT FROM circle_membership.seated(d.circle, cella.verdict_date()) s WHERE s = cella.actor())
      OR NOT EXISTS (SELECT FROM membership.member m WHERE m.address = cella.actor() AND m.status = 'active')
      THEN cella.actor() || ' holds no seat in ' || d.circle || ', so may not ' || split_part(cella.op(), ':', 3) || ' ' || d.id
  END
  FROM (SELECT payload ->> 'decision' AS decision) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('decision:decision:propose', 'circle_decision_membership.sits(jsonb)', 'circle-decision-membership'),
  ('decision:decision:close', 'circle_decision_membership.sits(jsonb)', 'circle-decision-membership');
