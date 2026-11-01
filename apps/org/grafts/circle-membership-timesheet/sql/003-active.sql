-- A worker sits in a circle only as an active member, as membership says
-- one is on the verdict date (`membership.active`), not by a copy of its
-- status.
CREATE OR REPLACE FUNCTION circle_membership_timesheet.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN membership.active(w.member, cella.verdict_date())
      AND NOT EXISTS (
        SELECT FROM circle_membership.seat s
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
