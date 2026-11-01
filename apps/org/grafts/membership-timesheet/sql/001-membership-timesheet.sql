CREATE SCHEMA membership_timesheet;

-- Whose time an entry is, as the members see it: no member's who is
-- suspended or has left. A worker logs their own while employed, member
-- or not, which is employment-timesheet's; Inès, invited and employed, logs
-- hers before the assembly admits her. Whether the actor may log at all is
-- the log-time power's.
CREATE FUNCTION membership_timesheet.whose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM membership.member m WHERE m.address = NEW.member AND m.status IN ('suspended', 'exited')) THEN
    RAISE EXCEPTION '% is a member suspended or gone: they log no time', NEW.member
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER whose BEFORE INSERT ON timesheet.entry
  FOR EACH ROW EXECUTE FUNCTION membership_timesheet.whose();

GRANT USAGE ON SCHEMA membership_timesheet TO cella_app, cella_guards;
