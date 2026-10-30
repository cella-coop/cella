-- The client-project graft's analytical contract: which client commissioned
-- each project.
CREATE VIEW client_project.commissions AS
SELECT c.project, c.client
FROM client_project.commission c;
