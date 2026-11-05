-- The meeting-motion graft's analytical contract: which motion each
-- meeting's agenda item tables.
CREATE VIEW meeting_motion.tablings AS
SELECT t.item, t.meeting, t.motion, t.circle
FROM meeting_motion.tabled t;
COMMENT ON VIEW meeting_motion.tablings IS 'audience: scoped by circle';
