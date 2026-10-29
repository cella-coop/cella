-- The stances that count on a decision: its electorate's, received before
-- its cutoff, but a stance the sweep redacted, which counts as none given.
CREATE OR REPLACE FUNCTION circle_decision_membership.stances(ref text) RETURNS SETOF decision.vote
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT v.*
  FROM decision.vote v
  JOIN decision.decision d ON d.id = v.decision
  WHERE v.decision = ref
    AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    AND v.stance <> 'redacted'
    AND v.member IN (SELECT circle_decision_membership.electorate(ref));
END;

-- What every member reads of a decision's count: whether it passes, how
-- many count, how many of them gave a stance and whether that meets its
-- quorum. A secret ballot's is sealed, every field null, until its close.
-- It runs as its owner, since a member reads no other's secret stance.
CREATE FUNCTION circle_decision_membership.tally(ref text, OUT passes boolean, OUT counted integer, OUT given integer, OUT quorate boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT circle_decision_membership.passes(d.id), t.counted, t.given, t.quorate
  FROM decision.decision d
  CROSS JOIN LATERAL circle_decision_membership.turnout(d.id) t
  WHERE d.id = ref AND (d.closed IS NOT NULL OR NOT decision.secret(d.id));
END;

REVOKE EXECUTE ON FUNCTION circle_decision_membership.tally(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION circle_decision_membership.tally(text) TO cella_app;
