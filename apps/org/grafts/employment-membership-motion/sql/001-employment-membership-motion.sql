CREATE SCHEMA employment_membership_motion;

-- Each candidate's admission: their probation and the shares they pledge,
-- and the latest motion that moves to admit them, open ones first, with
-- whether it is still open. A candidate whose probation is over, who is
-- invited and whom no open motion moves to admit, is due a proposal.
CREATE VIEW employment_membership_motion.admission AS
SELECT p.address, p.name, p.stage, p.hired, p.probation_end, p.pledged,
       d.id AS motion, d.title, d.deadline, d.closed,
       (p.stage = 'invited' AND p.probation_end < cella.verdict_date() AND (d.id IS NULL OR d.closed IS NOT NULL)) AS due
FROM employment_membership.path p
LEFT JOIN LATERAL (
  SELECT x.id, x.title, x.deadline, x.closed
  FROM membership_motion.action m
  JOIN motion.motion x ON x.id = m.motion
  WHERE m.kind = 'admit' AND m.member = p.address
  ORDER BY x.closed IS NULL DESC, x.proposed DESC, x.id DESC
  LIMIT 1
) d ON true
WHERE p.probation IS NOT NULL AND p.stage IN ('candidate', 'invited');

GRANT USAGE ON SCHEMA employment_membership_motion TO cella_app, cella_guards;
GRANT SELECT ON employment_membership_motion.admission TO cella_app, cella_guards;
