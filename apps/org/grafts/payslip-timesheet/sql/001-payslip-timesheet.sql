CREATE SCHEMA payslip_timesheet;

-- The minutes a member logged in a month.
CREATE FUNCTION payslip_timesheet.minutes(member text, month text) RETURNS integer
LANGUAGE sql STABLE
RETURN (
  SELECT coalesce(sum(e.minutes), 0)::integer FROM timesheet.entry e
  WHERE e.member = minutes.member AND timesheet.month_of(e.day) = minutes.month
);

-- payslip:run:generate — a run is prepared from approved time: every
-- payslip's member had their month approved, and the payslip holds its
-- minutes. A month still open or only submitted holds the run back, and
-- the approval it waits for is ordered, so the time a run reads never
-- changes after.
CREATE FUNCTION payslip_timesheet.timed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN u.member IS NOT NULL
      THEN u.member || '''s ' || x.month || ' is ' || coalesce(u.state, 'not logged') || ', not approved: the run waits for it'
    WHEN m.member IS NOT NULL
      THEN m.member || '''s payslip for ' || x.month || ' does not hold the minutes of their approved month'
  END
  FROM (SELECT payload ->> 'month' AS month) x
  LEFT JOIN LATERAL (
    SELECT p.member, s.state
    FROM payslip.payslip p
    LEFT JOIN timesheet.sheet s ON s.member = p.member AND s.month = p.month
    WHERE p.month = x.month AND s.approved IS NULL
    ORDER BY p.member
    LIMIT 1
  ) u ON true
  LEFT JOIN LATERAL (
    SELECT p.member
    FROM payslip.payslip p
    WHERE p.month = x.month AND p.minutes IS DISTINCT FROM payslip_timesheet.minutes(p.member, p.month)
    ORDER BY p.member
    LIMIT 1
  ) m ON true;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('payslip:run:generate', 'payslip_timesheet.timed(jsonb)', 'payslip-timesheet');

GRANT USAGE ON SCHEMA payslip_timesheet TO cella_app, cella_guards;
