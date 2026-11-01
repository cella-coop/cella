CREATE SCHEMA circle_meeting;

-- How a circle meets: the share of its seats that must be present for a
-- meeting to be quorate, in percent, and whether its minutes are adopted
-- by motion before they bind. A circle with no row here needs half its
-- seats and keeps its minutes as written. Set by the seed until a
-- motion sets it.
CREATE TABLE circle_meeting.setting (
  circle text PRIMARY KEY,
  quorum integer NOT NULL DEFAULT 50 CHECK (quorum BETWEEN 1 AND 100),
  adopts boolean NOT NULL DEFAULT false
);

-- Both sides resolve: the circle exists.
CREATE FUNCTION circle_meeting.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = NEW.circle) THEN
    RAISE EXCEPTION 'no circle %', NEW.circle USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON circle_meeting.setting
  FOR EACH ROW EXECUTE FUNCTION circle_meeting.resolves();

-- meeting:meeting:schedule — the meeting is a circle's that exists.
CREATE FUNCTION circle_meeting.meets(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no circle ' || coalesce(m.circle, w.circle, 'is named') || ' to meet'
  END
  FROM (SELECT payload ->> 'meeting' AS meeting, payload ->> 'circle' AS circle) w
  LEFT JOIN meeting.meeting m ON m.id = w.meeting
  LEFT JOIN circle.circle c ON c.id = coalesce(m.circle, w.circle);
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('meeting:meeting:schedule', 'circle_meeting.meets(jsonb)', 'circle-meeting');

GRANT USAGE ON SCHEMA circle_meeting TO cella_app, cella_guards;
GRANT SELECT ON circle_meeting.setting TO cella_app, cella_guards;
