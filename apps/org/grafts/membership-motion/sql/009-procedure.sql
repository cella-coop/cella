-- Who counts on a motion: once it is closed, the members counted at its
-- close; while it is open, the members on its roll who are active now.
CREATE FUNCTION membership_motion.electorate(ref text) RETURNS SETOF text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT c.member
  FROM membership_motion.counted c
  JOIN motion.motion d ON d.id = c.motion AND d.closed IS NOT NULL
  WHERE c.motion = ref
  UNION
  SELECT r.member
  FROM membership_motion.roll r
  JOIN motion.motion d ON d.id = r.motion AND d.closed IS NULL
  JOIN membership.member m ON m.address = r.member AND m.status = 'active'
  WHERE r.motion = ref;
END;

-- The stances that count on a motion: its electorate's, received before
-- its cutoff.
CREATE FUNCTION membership_motion.stances(ref text) RETURNS SETOF motion.vote
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT v.*
  FROM motion.vote v
  JOIN motion.motion d ON d.id = v.motion
  WHERE v.motion = ref
    AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    AND v.member IN (SELECT membership_motion.electorate(ref));
END;

-- How many count on a motion, how many of them gave a stance, and
-- whether that meets its procedure's quorum: at least `quorum_num` in
-- every `quorum_den` of those counted. An abstention takes part.
CREATE FUNCTION membership_motion.turnout(ref text, OUT counted integer, OUT given integer, OUT quorate boolean)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT e.n, s.n, s.n * p.quorum_den >= p.quorum_num * e.n
  FROM motion.motion d
  JOIN motion.procedure p ON p.id = d.procedure
  CROSS JOIN LATERAL (SELECT count(*)::integer AS n FROM membership_motion.electorate(d.id)) e
  CROSS JOIN LATERAL (SELECT count(DISTINCT x.member)::integer AS n FROM membership_motion.stances(d.id) x) s
  WHERE d.id = ref;
END;

-- Whether a motion passes by its procedure, over the stances that count:
-- its quorum met, and then by its method, `cella.consent`, or for a majority
-- `cella.majority`, more for than against, or `cella.share`, the share of
-- the votes cast the procedure needs, as two thirds; and no veto, no one
-- on its roll who may veto it giving, as their latest stance that counts,
-- one against or an objection.
CREATE OR REPLACE FUNCTION membership_motion.passes(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT (SELECT t.quorate FROM membership_motion.turnout(d.id) t) AND CASE
    WHEN d.method = 'consent' THEN (
      SELECT cella.consent(s.member, s.stance, s.receipt) FROM membership_motion.stances(d.id) s
    )
    WHEN p.share_num IS NULL THEN (
      SELECT cella.majority(s.member, s.stance, s.receipt) FROM membership_motion.stances(d.id) s
    )
    ELSE (
      SELECT cella.share(s.member, s.stance, s.receipt, p.share_num::bigint, p.share_den::bigint)
      FROM membership_motion.stances(d.id) s
    )
  END
  AND NOT EXISTS (
    SELECT FROM membership_motion.stances(d.id) s
    JOIN membership_motion.roll r ON r.motion = d.id AND r.member = s.member AND r.veto
    WHERE s.stance IN ('against', 'object')
      AND s.receipt = (SELECT max(x.receipt) FROM membership_motion.stances(d.id) x WHERE x.member = s.member)
  )
  FROM motion.motion d
  JOIN motion.procedure p ON p.id = d.procedure
  WHERE d.id = ref;
END;
