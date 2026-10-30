-- The meeting-membership graft's analytical contract: who attended each
-- meeting, as marked.
CREATE VIEW meeting_membership.attendance_marked AS
SELECT a.meeting, a.member, a.status, a.marked
FROM meeting_membership.attendance a;
