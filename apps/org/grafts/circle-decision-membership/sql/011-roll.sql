-- A decision's roll is fixed by this graft's own proposal, in its write,
-- and no longer by a trigger on the decision feat's table (writes stay
-- home): its handler calls `fix` after the decision feat's `proposing`,
-- and `fixed` refuses a proposal that did not.
DROP TRIGGER fix_roll ON decision.decision;
DROP FUNCTION circle_decision_membership.fix_roll();

-- Fixes a decision's roll as it is proposed: the members seated in its
-- circle on the day it is proposed, from circle-membership's seats, a
-- lower order than this graft; returns how many. It runs with its
-- owner's rights, since nothing else writes the table.
CREATE FUNCTION circle_decision_membership.fix(ref text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO circle_decision_membership.roll (decision, member)
  SELECT d.id, s FROM decision.decision d CROSS JOIN LATERAL circle_membership.seated(d.circle, d.proposed) s
  WHERE d.id = ref;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

REVOKE EXECUTE ON FUNCTION circle_decision_membership.fix(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION circle_decision_membership.fix(text) TO cella_app;

-- decision:decision:propose — the decision's roll is exactly the members
-- seated in its circle on the day it is proposed: the proposal fixed it.
CREATE FUNCTION circle_decision_membership.fixed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT s FROM circle_membership.seated(d.circle, d.proposed) s)
      EXCEPT
      (SELECT r.member FROM circle_decision_membership.roll r WHERE r.decision = d.id)
    ) OR EXISTS (
      (SELECT r.member FROM circle_decision_membership.roll r WHERE r.decision = d.id)
      EXCEPT
      (SELECT s FROM circle_membership.seated(d.circle, d.proposed) s)
    ) THEN d.id || '''s proposal did not fix its roll: its roll is those seated in ' || d.circle || ' on the day it is proposed'
  END
  FROM (SELECT payload ->> 'decision' AS decision) p
  JOIN decision.decision d ON d.id = p.decision;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('decision:decision:propose', 'circle_decision_membership.fixed(jsonb)', 'circle-decision-membership');
