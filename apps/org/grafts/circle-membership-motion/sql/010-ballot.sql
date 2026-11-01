-- The stances that count on a motion: its electorate's, received before
-- its cutoff, but a stance the sweep redacted, which counts as none given.
CREATE OR REPLACE FUNCTION circle_membership_motion.stances(ref text) RETURNS SETOF motion.vote
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT v.*
  FROM motion.vote v
  JOIN motion.motion d ON d.id = v.motion
  WHERE v.motion = ref
    AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    AND v.stance <> 'redacted'
    AND v.member IN (SELECT circle_membership_motion.electorate(ref));
END;

-- What every member reads of a motion's count: whether it passes, how
-- many count, how many of them gave a stance and whether that meets its
-- quorum. A secret ballot's is sealed, every field null, until its close.
-- It runs as its owner, since a member reads no other's secret stance.
CREATE FUNCTION circle_membership_motion.tally(ref text, OUT passes boolean, OUT counted integer, OUT given integer, OUT quorate boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT circle_membership_motion.passes(d.id), t.counted, t.given, t.quorate
  FROM motion.motion d
  CROSS JOIN LATERAL circle_membership_motion.turnout(d.id) t
  WHERE d.id = ref AND (d.closed IS NOT NULL OR NOT motion.secret(d.id));
END;

REVOKE EXECUTE ON FUNCTION circle_membership_motion.tally(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION circle_membership_motion.tally(text) TO cella_app;
