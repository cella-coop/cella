-- The document-meeting graft's analytical contract: which document holds
-- each meeting's minutes.
CREATE VIEW document_meeting.minuted AS
SELECT m.meeting, m.document, m.circle
FROM document_meeting.minutes m;
COMMENT ON VIEW document_meeting.minuted IS 'audience: scoped by circle';
