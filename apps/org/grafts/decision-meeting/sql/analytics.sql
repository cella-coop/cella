-- The decision-meeting graft's analytical contract: which decision each
-- meeting's agenda item tables.
CREATE VIEW decision_meeting.tablings AS
SELECT t.item, t.meeting, t.decision
FROM decision_meeting.tabled t;
