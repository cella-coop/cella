CREATE SCHEMA employment_timesheet;

-- Whose time an entry is, where it is a worker's: theirs on a day of their
-- employment, never before their hire nor after they leave. An entry of
-- no worker's, a member's who is not employed, is membership-timesheet's to
-- judge.
CREATE FUNCTION employment_timesheet.whose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM employment.worker w WHERE w.address = NEW.member) AND NOT employment.employed(NEW.member, NEW.day) THEN
    RAISE EXCEPTION '% is not employed on %: a worker logs time while employed', NEW.member, NEW.day
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER worker BEFORE INSERT ON timesheet.entry
  FOR EACH ROW EXECUTE FUNCTION employment_timesheet.whose();

-- Each worker's months, by name, one for each circle they worked for:
-- their hours and where each stands, and who approved it.
CREATE VIEW employment_timesheet.sheet AS
SELECT s.member, wp.name, s.month, s.circle, s.hours, s.billable, s.entries, s.state, s.submitted, s.approved,
       s.approver, ap.name AS approver_name
FROM timesheet.sheet s
JOIN (employment.worker w JOIN person.person wp ON wp.address = w.address) ON w.address = s.member
LEFT JOIN (employment.worker a JOIN person.person ap ON ap.address = a.address) ON a.address = s.approver;

GRANT USAGE ON SCHEMA employment_timesheet TO cella_app, cella_guards;
GRANT SELECT ON employment_timesheet.sheet TO cella_app, cella_guards;
