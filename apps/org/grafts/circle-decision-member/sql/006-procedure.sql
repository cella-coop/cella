-- Who counts on a decision: once it is closed, the members counted at its
-- close; while it is open, the members on its roll who are active now.
CREATE FUNCTION circle_decision_member.electorate(ref text) RETURNS SETOF text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT c.member
  FROM circle_decision_member.counted c
  JOIN decision.decision d ON d.id = c.decision AND d.closed IS NOT NULL
  WHERE c.decision = ref
  UNION
  SELECT r.member
  FROM circle_decision_member.roll r
  JOIN decision.decision d ON d.id = r.decision AND d.closed IS NULL
  JOIN member.member m ON m.address = r.member AND m.status = 'active'
  WHERE r.decision = ref;
END;

-- The stances that count on a decision: its electorate's, received before
-- its cutoff.
CREATE FUNCTION circle_decision_member.stances(ref text) RETURNS SETOF decision.vote
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT v.*
  FROM decision.vote v
  JOIN decision.decision d ON d.id = v.decision
  WHERE v.decision = ref
    AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    AND v.member IN (SELECT circle_decision_member.electorate(ref));
END;

-- How many count on a decision, how many of them gave a stance, and
-- whether that meets its procedure's quorum: at least `quorum_num` in
-- every `quorum_den` of those counted. An abstention takes part.
CREATE FUNCTION circle_decision_member.turnout(ref text, OUT counted integer, OUT given integer, OUT quorate boolean)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT e.n, s.n, s.n * p.quorum_den >= p.quorum_num * e.n
  FROM decision.decision d
  JOIN decision.procedure p ON p.id = d.procedure
  CROSS JOIN LATERAL (SELECT count(*)::integer AS n FROM circle_decision_member.electorate(d.id)) e
  CROSS JOIN LATERAL (SELECT count(DISTINCT x.member)::integer AS n FROM circle_decision_member.stances(d.id) x) s
  WHERE d.id = ref;
END;

-- Whether a decision passes by its procedure, over the stances that count:
-- its quorum met, and then by its rule, `cella.consent`, or for a majority
-- `cella.majority`, more for than against, or `cella.share`, the share of
-- the votes cast the procedure needs, as two thirds.
CREATE OR REPLACE FUNCTION circle_decision_member.passes(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT (SELECT t.quorate FROM circle_decision_member.turnout(d.id) t) AND CASE
    WHEN d.rule = 'consent' THEN (
      SELECT cella.consent(s.member, s.stance, s.receipt) FROM circle_decision_member.stances(d.id) s
    )
    WHEN p.share_num IS NULL THEN (
      SELECT cella.majority(s.member, s.stance, s.receipt) FROM circle_decision_member.stances(d.id) s
    )
    ELSE (
      SELECT cella.share(s.member, s.stance, s.receipt, p.share_num::bigint, p.share_den::bigint)
      FROM circle_decision_member.stances(d.id) s
    )
  END
  FROM decision.decision d
  JOIN decision.procedure p ON p.id = d.procedure
  WHERE d.id = ref;
END;
