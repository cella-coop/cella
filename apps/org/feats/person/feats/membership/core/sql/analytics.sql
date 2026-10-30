-- The membership feat's analytical contract: each member's standing,
-- shares and days, by address.
CREATE VIEW membership.members AS
SELECT m.address, m.status, m.since, m.shares, m.invited, m.suspended, m.exited
FROM membership.member m;
