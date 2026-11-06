-- The contact-project graft's analytical contract: which contact commissioned
-- each project.
CREATE VIEW contact_project.commissions AS
SELECT c.project, c.contact, c.circle
FROM contact_project.commission c;
COMMENT ON VIEW contact_project.commissions IS 'audience: scoped by circle';
