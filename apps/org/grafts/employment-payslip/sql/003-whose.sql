-- Whose pay is, as a guard on the run that makes the payslips rather than
-- triggers on the payslip feat's tables: a graft refuses a feat's write
-- by a guard on the op, which the notary runs.
DROP TRIGGER worker ON payslip.salary;
DROP TRIGGER worker ON payslip.payslip;
DROP FUNCTION employment_payslip.whose();

-- payslip:run:generate — every payslip of the run is a worker's employed
-- in its month, member or not, never before their hire nor after they
-- leave. The payslip feat holds the address, as text; this graft checks
-- it against the workers. A salary is written by no op: a run turns each
-- into a payslip, so a salary of no worker's is refused there, and so is
-- one in force after its worker leaves: the last salary of a worker whose
-- contract names its last day ends no later than that day.
CREATE FUNCTION employment_payslip.whose(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT x.why FROM (
    SELECT 1 AS k, s.member,
           s.member || '''s salary from ' || s."from" ||
           coalesce(' ends on ' || s.until || ', after their last day, ', ' has no end, though their last day is ') || w.until ||
           ': a salary ends when its worker leaves' AS why
    FROM (SELECT DISTINCT ON (y.member) y.member, y."from", y.until FROM payslip.salary y ORDER BY y.member, y."from" DESC) s
    JOIN employment.worker w ON w.address = s.member
    WHERE w.until IS NOT NULL AND (s.until IS NULL OR s.until > w.until)
    UNION ALL
    SELECT 2, p.member, CASE
      WHEN NOT EXISTS (SELECT FROM employment.worker w WHERE w.address = p.member)
        THEN p.member || ' is no worker: a payslip is one''s'
      ELSE p.member || ' is employed in no day of ' || p.month || ': a payslip is a worker''s for a month they worked'
    END
    FROM payslip.payslip p
    WHERE p.month = payload ->> 'month' AND NOT employment.employed_in(p.member, p.month)
  ) x
  ORDER BY x.k, x.member
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('payslip:run:generate', 'employment_payslip.whose(jsonb)', 'employment-payslip');
