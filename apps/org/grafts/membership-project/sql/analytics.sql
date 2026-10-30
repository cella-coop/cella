-- The membership-project graft's analytical contract: the shares of each
-- project's pot granted to members.
CREATE VIEW membership_project.shares AS
SELECT s.id, s.project, s.member, cella.cents(s.amount) AS amount, s.granted
FROM membership_project.share s;
