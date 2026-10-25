CREATE SCHEMA employment_payslip;

-- Whose a salary and a payslip are: a worker's, member or not, and a
-- payslip one employed in its month. The payslip feat holds the address,
-- as text; this graft checks it against the workers.
CREATE FUNCTION employment_payslip.whose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'salary' THEN
    IF NOT EXISTS (SELECT FROM employment.worker w WHERE w.address = NEW.member) THEN
      RAISE EXCEPTION '% is no worker: a salary is one''s', NEW.member
        USING ERRCODE = 'triggered_action_exception';
    END IF;
  ELSIF NOT employment.employed_in(NEW.member, NEW.month) THEN
    RAISE EXCEPTION '% is employed in no day of %: a payslip is a worker''s for a month they worked', NEW.member, NEW.month
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER worker BEFORE INSERT ON payslip.salary
  FOR EACH ROW EXECUTE FUNCTION employment_payslip.whose();
CREATE TRIGGER worker BEFORE INSERT ON payslip.payslip
  FOR EACH ROW EXECUTE FUNCTION employment_payslip.whose();

-- Each payslip with its worker's name and job.
CREATE VIEW employment_payslip.slip AS
SELECT p.month, p.member, wp.name, w.job
FROM payslip.payslip p
JOIN (employment.worker w JOIN person.person wp ON wp.address = w.address) ON w.address = p.member;

GRANT USAGE ON SCHEMA employment_payslip TO cella_app, cella_rules;
GRANT SELECT ON employment_payslip.slip TO cella_app, cella_rules;
