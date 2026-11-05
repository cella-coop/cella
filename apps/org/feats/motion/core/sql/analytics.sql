-- The motion feat's analytical contract: each motion, its procedure
-- and its days. Stances are not shared: a secret ballot's roll is never
-- shown, and an open one's is on the motion's page.
CREATE VIEW motion.motions AS
SELECT d.id, d.circle, d.title, d.method, d.procedure, d.ballot, d.proposed, d.deadline, d.closed
FROM motion.motion d;
COMMENT ON VIEW motion.motions IS 'audience: scoped by circle';

CREATE VIEW motion.procedures AS
SELECT p.id, p.label, p.method, p.share_num, p.share_den, p.quorum_num, p.quorum_den, p.ballot
FROM motion.procedure p;
COMMENT ON VIEW motion.procedures IS 'audience: shared by id';
