-- The circle-membership graft's analytical contract: who holds which role
-- in which circle, and when.
CREATE VIEW circle_membership.seats AS
SELECT p.id, p.circle, p.member, p.role, p.since, p.until
FROM circle_membership.seat p;
