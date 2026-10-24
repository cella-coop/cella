-- What of pay is personal data: a member's salary and each payslip's
-- figures, of class `payroll`, which the law keeps five years (Code du
-- travail, art. L3243-4). Erasing a member who has left restricts them;
-- once their clock runs out the sweep redacts them to NULL, so the
-- figures are nullable, and an approved run's payslips take that one
-- change.
ALTER TABLE payslip.salary ALTER COLUMN gross DROP NOT NULL;
ALTER TABLE payslip.payslip
  ALTER COLUMN gross DROP NOT NULL,
  ALTER COLUMN employee DROP NOT NULL,
  ALTER COLUMN employer DROP NOT NULL,
  ALTER COLUMN net DROP NOT NULL;

INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('payslip', 'salary', 'gross', 'payroll', 'member', 'payslip'),
  ('payslip', 'payslip', 'gross', 'payroll', 'member', 'payslip'),
  ('payslip', 'payslip', 'employee', 'payroll', 'member', 'payslip'),
  ('payslip', 'payslip', 'employer', 'payroll', 'member', 'payslip'),
  ('payslip', 'payslip', 'net', 'payroll', 'member', 'payslip');

COMMENT ON COLUMN payslip.run.approver IS 'not personal: the approver''s pseudonymous address';

-- As before, but for the notary's redaction (`cella.redacting()`), the one
-- change an approved run's payslips take.
CREATE OR REPLACE FUNCTION payslip.stays() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'payslip' AND TG_OP = 'UPDATE' AND cella.redacting() THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'run' THEN
    IF OLD.approved IS NOT NULL AND (NEW.approved, NEW.approver) IS DISTINCT FROM (OLD.approved, OLD.approver) THEN
      RAISE EXCEPTION 'the % run was approved on %', OLD.month, OLD.approved
        USING ERRCODE = 'triggered_action_exception';
    END IF;
    IF OLD.paid IS NOT NULL THEN
      RAISE EXCEPTION 'the % run was paid on %', OLD.month, OLD.paid
        USING ERRCODE = 'triggered_action_exception';
    END IF;
    IF NEW.paid IS NOT NULL AND NEW.approved IS NULL THEN
      RAISE EXCEPTION 'the % run is not approved', OLD.month
        USING ERRCODE = 'triggered_action_exception';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT FROM payslip.run r WHERE r.month = coalesce(NEW.month, OLD.month) AND r.approved IS NOT NULL) THEN
    RAISE EXCEPTION 'the % run is approved: its payslips never change', coalesce(NEW.month, OLD.month)
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;
