CREATE SCHEMA member_timesheet;

-- Whose time an entry is: an active member's. Exited, suspended and
-- invited members log none; whether the actor may log at all is the
-- log-time power's.
CREATE FUNCTION member_timesheet.whose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM member.member m WHERE m.address = NEW.member AND m.status = 'active') THEN
    RAISE EXCEPTION '% is no active member: time is logged by one', NEW.member
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER whose BEFORE INSERT ON timesheet.entry
  FOR EACH ROW EXECUTE FUNCTION member_timesheet.whose();

-- Each member's months, by name: their hours and where each stands, and
-- who approved it.
CREATE VIEW member_timesheet.sheet AS
SELECT s.member, m.name, s.month, s.hours, s.billable, s.entries, s.state, s.submitted, s.approved,
       s.approver, a.name AS approver_name
FROM timesheet.sheet s
JOIN member.member m ON m.address = s.member
LEFT JOIN member.member a ON a.address = s.approver;

GRANT USAGE ON SCHEMA member_timesheet TO cella_app, cella_rules;
GRANT SELECT ON member_timesheet.sheet TO cella_app, cella_rules;
