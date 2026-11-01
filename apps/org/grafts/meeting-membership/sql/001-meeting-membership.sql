CREATE SCHEMA meeting_membership;

-- Who came to a meeting: each member marked present, excused or absent,
-- the last mark winning, with the day it was made and who made it. A
-- member with no row was not marked. Who was expected, the circle's
-- seats, is circle-meeting-membership's.
CREATE TABLE meeting_membership.attendance (
  meeting text NOT NULL,
  member text NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'excused', 'absent')),
  marked date,
  by text,
  PRIMARY KEY (meeting, member)
);

CREATE INDEX ON meeting_membership.attendance (member);

-- Both sides resolve: the meeting exists and is still scheduled, since
-- holding it fixes who came, and the member is an active one. The
-- meeting's row is read FOR SHARE, as its agenda's are, so a mark and a
-- concurrent hold are serialised.
CREATE FUNCTION meeting_membership.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF NOT EXISTS (SELECT FROM membership.member mm WHERE mm.address = NEW.member AND mm.status = 'active') THEN
    RAISE EXCEPTION '% is no active member: only a member attends', NEW.member
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON meeting_membership.attendance
  FOR EACH ROW EXECUTE FUNCTION meeting_membership.resolves();

-- meeting-membership:attendance:mark — a member marks their own attendance,
-- and no one else's.
CREATE FUNCTION meeting_membership.marks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.member IS DISTINCT FROM cella.actor()
      THEN 'only ' || coalesce(w.member, 'a member') || ' marks their own attendance; another''s is recorded by the minutes'' keeper'
  END
  FROM (SELECT payload ->> 'member' AS member) w;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('meeting-membership:attendance:mark', 'meeting_membership.marks(jsonb)', 'meeting-membership');

-- Recording another member's attendance is the minutes' keeper's; that
-- it reaches the meeting's circle, and that the member was expected
-- there, are circle-meeting-membership's guards on the op.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('meeting-membership:attendance:record', 'keep-minutes', NULL, 'meeting-membership');

GRANT USAGE ON SCHEMA meeting_membership TO cella_app, cella_guards;
GRANT SELECT, INSERT, UPDATE ON meeting_membership.attendance TO cella_app;
GRANT SELECT ON meeting_membership.attendance TO cella_guards;
