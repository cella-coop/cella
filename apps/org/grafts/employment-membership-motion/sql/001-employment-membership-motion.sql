CREATE SCHEMA employment_membership_motion;

-- Each motion that moves to admit someone, for whom it names and for
-- whoever reads its circle's motions: a candidate seated nowhere reads
-- the assembly's motion on them, and no one else's. It runs as its owner,
-- past motion's row-level policy, and keeps each row by its reader's test.
CREATE FUNCTION employment_membership_motion.admitting()
RETURNS TABLE (member text, motion text, title text, deadline date, closed date, proposed date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT m.member, x.id, x.title, x.deadline, x.closed, x.proposed
  FROM membership_motion.action m
  JOIN motion.motion x ON x.id = m.motion
  WHERE m.kind = 'admit'
    AND ((SELECT circle.whole()) OR x.circle = ANY ((SELECT cella.circles('motion'))::text[]) OR m.member = cella.reader());
END;
COMMENT ON FUNCTION employment_membership_motion.admitting() IS 'audience: shared: the motion that moves to admit a person, it keeps each for whom it names and the readers of its circle''s motions';

-- Each candidate's admission: their probation and the shares they pledge,
-- and the latest motion that moves to admit them, open ones first, with
-- whether it is still open. A candidate whose probation is over, who is
-- invited and whom no open motion moves to admit, is due a proposal.
CREATE VIEW employment_membership_motion.admission WITH (security_invoker = true) AS
SELECT p.address, p.name, p.stage, p.hired, p.probation_end, p.pledged,
       d.id AS motion, d.title, d.deadline, d.closed,
       (p.stage = 'invited' AND p.probation_end < cella.verdict_date() AND (d.id IS NULL OR d.closed IS NOT NULL)) AS due
FROM employment_membership.path p
LEFT JOIN LATERAL (
  SELECT a.motion AS id, a.title, a.deadline, a.closed
  FROM employment_membership_motion.admitting() a
  WHERE a.member = p.address
  ORDER BY a.closed IS NULL DESC, a.proposed DESC, a.motion DESC
  LIMIT 1
) d ON true
WHERE p.probation IS NOT NULL AND p.stage IN ('candidate', 'invited');

GRANT USAGE ON SCHEMA employment_membership_motion TO cella_app, cella_guards;
GRANT SELECT ON employment_membership_motion.admission TO cella_app, cella_guards;
GRANT EXECUTE ON FUNCTION employment_membership_motion.admitting() TO cella_app, cella_guards;
