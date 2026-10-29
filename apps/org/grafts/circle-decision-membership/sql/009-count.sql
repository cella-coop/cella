-- Who was counted at a close is fixed by this graft's own close, in its
-- write, and no longer by a trigger on the decision feat's table (writes
-- stay home): its handler calls `count` after the decision feat's
-- `closing`, and `counts` refuses a close that did not.
DROP TRIGGER count_roll ON decision.decision;
DROP FUNCTION circle_decision_membership.count_roll();

-- Fixes who is counted on a decision as it closes: the members of its roll
-- active (`membership.active`) on the verdict date; returns how many. It
-- runs with its owner's rights, since nothing else writes the table.
CREATE FUNCTION circle_decision_membership.count(ref text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO circle_decision_membership.counted (decision, member)
  SELECT r.decision, r.member
  FROM circle_decision_membership.roll r
  WHERE r.decision = ref AND membership.active(r.member, cella.verdict_date());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

REVOKE EXECUTE ON FUNCTION circle_decision_membership.count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION circle_decision_membership.count(text) TO cella_app;

-- decision:decision:close — those counted are exactly the members of the
-- decision's roll active on the verdict date: the close counted its roll.
CREATE FUNCTION circle_decision_membership.counts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT r.member FROM circle_decision_membership.roll r
       WHERE r.decision = p.decision AND membership.active(r.member, cella.verdict_date()))
      EXCEPT
      (SELECT c.member FROM circle_decision_membership.counted c WHERE c.decision = p.decision)
    ) OR EXISTS (
      (SELECT c.member FROM circle_decision_membership.counted c WHERE c.decision = p.decision)
      EXCEPT
      (SELECT r.member FROM circle_decision_membership.roll r
       WHERE r.decision = p.decision AND membership.active(r.member, cella.verdict_date()))
    ) THEN coalesce(p.decision, 'no decision') || '''s close did not count its roll: those counted are its active members on the day it closes'
  END
  FROM (SELECT payload ->> 'decision' AS decision) p;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('decision:decision:close', 'circle_decision_membership.counts(jsonb)', 'circle-decision-membership');
