-- Whose time an entry is, as the members see it: no member's who is
-- suspended or has left. A worker logs their own while employed, member
-- or not, which is timesheet-worker's; Inès, invited and employed, logs
-- hers before the assembly admits her.
CREATE OR REPLACE FUNCTION member_timesheet.whose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM member.member m WHERE m.address = NEW.member AND m.status IN ('suspended', 'exited')) THEN
    RAISE EXCEPTION '% is a member suspended or gone: they log no time', NEW.member
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;
