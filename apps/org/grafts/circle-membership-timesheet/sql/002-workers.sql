-- timesheet:period:approve — as before, the approver holds the op's power
-- over a circle the member sits in on the verdict date; but a worker who
-- is no active member sits in no circle, so anyone holding approve-time
-- approves their time, as finance approves Inès's.
CREATE OR REPLACE FUNCTION circle_membership_timesheet.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (SELECT FROM membership.member m WHERE m.address = w.member AND m.status = 'active')
      AND NOT EXISTS (
        SELECT FROM circle_membership.position s
        WHERE s.member = w.member
          AND (s.since IS NULL OR s.since <= cella.verdict_date())
          AND (s.until IS NULL OR s.until > cella.verdict_date())
          AND circle_membership.over(cella.actor(), w.power, s.circle, cella.verdict_date())
      ) THEN cella.actor() || ' holds ' || coalesce(w.power, 'no power') || ' over no circle ' || coalesce(w.member, 'no one') || ' sits in'
  END
  FROM (
    SELECT payload ->> 'member' AS member, (SELECT p.power FROM cella.power p WHERE p.op = cella.action()) AS power
  ) w;
END;
