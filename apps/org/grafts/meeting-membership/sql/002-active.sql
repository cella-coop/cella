-- Who attends is an active member as membership says one is, on the
-- verdict date (`membership.active`), not by a copy of its status.
CREATE OR REPLACE FUNCTION meeting_membership.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  m meeting.meeting;
BEGIN
  SELECT * INTO m FROM meeting.meeting WHERE id = NEW.meeting FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no meeting %', NEW.meeting USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF m.status <> 'scheduled' THEN
    RAISE EXCEPTION '% was % on %: who came is fixed', m.id, m.status, m.settled
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT membership.active(NEW.member, cella.verdict_date()) THEN
    RAISE EXCEPTION '% is no active member: only a member attends', NEW.member
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;
