-- The client-project graft's analytical contract: which client commissioned
-- each project.
CREATE VIEW client_project.commissions AS
SELECT c.project, c.client, c.circle
FROM client_project.commission c;
COMMENT ON VIEW client_project.commissions IS 'audience: scoped by circle';
