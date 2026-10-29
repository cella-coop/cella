-- The decision feat's analytical contract: each decision, its procedure
-- and its days. Stances are not shared: a secret ballot's roll is never
-- shown, and an open one's is on the decision's page.
CREATE VIEW decision.decisions AS
SELECT d.id, d.circle, d.title, d.rule, d.procedure, d.ballot, d.proposed, d.deadline, d.closed
FROM decision.decision d;

CREATE VIEW decision.procedures AS
SELECT p.id, p.label, p.rule, p.share_num, p.share_den, p.quorum_num, p.quorum_den, p.ballot
FROM decision.procedure p;
