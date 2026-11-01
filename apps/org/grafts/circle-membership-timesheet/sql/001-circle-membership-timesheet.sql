CREATE SCHEMA circle_membership_timesheet;

-- timesheet:period:approve — the approver holds the op's power over a
-- circle the member sits in on the verdict date (`circle_membership.over`):
-- a lead approves the time of their own circle's members and no one
-- else's; the gérante, through the assembly, anyone's.
CREATE FUNCTION circle_membership_timesheet.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (
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

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('timesheet:period:approve', 'circle_membership_timesheet.approves(jsonb)', 'circle-membership-timesheet');

GRANT USAGE ON SCHEMA circle_membership_timesheet TO cella_app, cella_guards;
