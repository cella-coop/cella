-- The meeting feat's analytical contract: each meeting, its circle and its
-- days, and the items on its agenda with their time.
CREATE VIEW meeting.meetings AS
SELECT m.id, m.circle, m.title, m.status, m.scheduled, m.at::date AS day, m.settled, m.minuted
FROM meeting.meeting m;

CREATE VIEW meeting.items AS
SELECT i.id, i.meeting, i.title, i.minutes
FROM meeting.item i;
