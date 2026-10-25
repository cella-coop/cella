CREATE SCHEMA decision_employment_membership;

-- Each candidate's admission: their probation and the shares they pledge,
-- and the latest decision that moves to admit them, open ones first, with
-- whether it is still open. A candidate whose probation is over, who is
-- invited and whom no open decision moves to admit, is due a proposal.
CREATE VIEW decision_employment_membership.admission AS
SELECT p.address, p.name, p.stage, p.hired, p.probation_end, p.pledged,
       d.id AS decision, d.title, d.deadline, d.closed,
       (p.stage = 'invited' AND p.probation_end < cella.verdict_date() AND (d.id IS NULL OR d.closed IS NOT NULL)) AS due
FROM employment_membership.path p
LEFT JOIN LATERAL (
  SELECT x.id, x.title, x.deadline, x.closed
  FROM decision_membership.motion m
  JOIN decision.decision x ON x.id = m.decision
  WHERE m.kind = 'admit' AND m.member = p.address
  ORDER BY x.closed IS NULL DESC, x.proposed DESC, x.id DESC
  LIMIT 1
) d ON true
WHERE p.probation IS NOT NULL AND p.stage IN ('candidate', 'invited');

GRANT USAGE ON SCHEMA decision_employment_membership TO cella_app, cella_rules;
GRANT SELECT ON decision_employment_membership.admission TO cella_app, cella_rules;
