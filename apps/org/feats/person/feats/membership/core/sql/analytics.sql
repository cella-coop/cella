-- The membership feat's analytical contract: each member's standing,
-- shares and days, by address.
CREATE VIEW membership.members AS
SELECT m.address, m.status, m.since, m.shares, m.invited, m.suspended, m.exited, m.circle
FROM membership.member m;
COMMENT ON VIEW membership.members IS 'audience: scoped by circle and address';
