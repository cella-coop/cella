CREATE SCHEMA member_payslip;

-- Whose a salary and a payslip are: a member's, and a payslip an active
-- one's. The payslip feat holds the address, as text; this graft checks
-- it against the members.
CREATE FUNCTION member_payslip.whose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM member.member m
    WHERE m.address = NEW.member AND (TG_TABLE_NAME = 'salary' OR m.status = 'active')
  ) THEN
    RAISE EXCEPTION '% is no % member: a % is one''s', NEW.member, CASE TG_TABLE_NAME WHEN 'salary' THEN 'known' ELSE 'active' END, TG_TABLE_NAME
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER whose BEFORE INSERT ON payslip.salary
  FOR EACH ROW EXECUTE FUNCTION member_payslip.whose();
CREATE TRIGGER whose BEFORE INSERT ON payslip.payslip
  FOR EACH ROW EXECUTE FUNCTION member_payslip.whose();

-- Each payslip with its member's name.
CREATE VIEW member_payslip.slip AS
SELECT p.month, p.member, m.name
FROM payslip.payslip p
JOIN member.member m ON m.address = p.member;

GRANT USAGE ON SCHEMA member_payslip TO cella_app, cella_rules;
GRANT SELECT ON member_payslip.slip TO cella_app, cella_rules;
