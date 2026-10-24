CREATE SCHEMA meeting;

-- A meeting of a circle: the circle named as text, as a project names
-- its own, when and where it meets, by a place, a link or both, and where
-- it stands. `at` is the scope's wall-clock time, with no zone. A meeting
-- is scheduled, then held or cancelled, on the day `settled` names; its
-- minutes were begun on `minuted`. A meeting with no `scheduled` day was
-- scheduled before the records began.
CREATE TABLE meeting.meeting (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  circle text NOT NULL,
  title text NOT NULL CHECK (title <> ''),
  at timestamp NOT NULL,
  place text NOT NULL DEFAULT '',
  link text CHECK (link IS NULL OR link ~ '^https://'),
  scheduled date,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'held', 'cancelled')),
  settled date,
  minuted date,
  CHECK ((status = 'scheduled') = (settled IS NULL))
);

CREATE INDEX ON meeting.meeting (circle, at);

-- An item of a meeting's agenda: what is discussed, who presents it, and
-- for how long, in minutes. Items read in the order of `pos`; moving one
-- sets its own position between its new neighbours', so two moves of
-- different items never touch the same row.
CREATE TABLE meeting.item (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting text NOT NULL REFERENCES meeting.meeting,
  pos double precision NOT NULL,
  title text NOT NULL CHECK (title <> ''),
  presenter text NOT NULL DEFAULT '',
  minutes integer CHECK (minutes IS NULL OR minutes BETWEEN 1 AND 600)
);

CREATE INDEX ON meeting.item (meeting, pos);

-- A meeting held or cancelled stays so; only the day its minutes were
-- begun may still be set, and a cancelled meeting has none.
CREATE FUNCTION meeting.stays_settled() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND NEW.minuted IS NOT NULL THEN
    RAISE EXCEPTION '% was cancelled: it has no minutes', NEW.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.status <> 'scheduled'
    AND (NEW.status, NEW.settled, NEW.at, NEW.circle, NEW.title, NEW.place, NEW.link)
      IS DISTINCT FROM (OLD.status, OLD.settled, OLD.at, OLD.circle, OLD.title, OLD.place, OLD.link) THEN
    RAISE EXCEPTION '% was % on %', OLD.id, OLD.status, OLD.settled
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_settled BEFORE UPDATE ON meeting.meeting
  FOR EACH ROW EXECUTE FUNCTION meeting.stays_settled();

-- The agenda changes only while the meeting is scheduled: holding it
-- fixes what was on it. The meeting's row is read FOR SHARE and hold
-- updates it, so an edit and a concurrent hold are serialised, as a time
-- entry and its month's approval are.
CREATE FUNCTION meeting.open_agenda() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  m meeting.meeting;
BEGIN
  SELECT * INTO m FROM meeting.meeting WHERE id = coalesce(NEW.meeting, OLD.meeting) FOR SHARE;
  IF m.status <> 'scheduled' THEN
    RAISE EXCEPTION '% was % on %: its agenda is fixed', m.id, m.status, m.settled
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER open_agenda BEFORE INSERT OR UPDATE OR DELETE ON meeting.item
  FOR EACH ROW EXECUTE FUNCTION meeting.open_agenda();

-- meeting:meeting:hold — the write held a scheduled meeting on the
-- verdict date, which is not before the meeting's own day.
CREATE FUNCTION meeting.holds(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.id IS NULL THEN 'no meeting ' || coalesce(w.id, 'is named')
    WHEN m.status <> 'held' OR m.settled IS DISTINCT FROM cella.verdict_date() THEN m.id || ' was not held by this write'
    WHEN m.at::date > cella.verdict_date() THEN m.id || ' meets on ' || to_char(m.at, 'YYYY-MM-DD') || ': it is not held before'
  END
  FROM (SELECT payload ->> 'meeting' AS id) w
  LEFT JOIN meeting.meeting m ON m.id = w.id;
END;

-- meeting:meeting:cancel — the write cancelled a scheduled meeting on the
-- verdict date.
CREATE FUNCTION meeting.cancels(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.id IS NULL THEN 'no meeting ' || coalesce(w.id, 'is named')
    WHEN m.status <> 'cancelled' OR m.settled IS DISTINCT FROM cella.verdict_date() THEN m.id || ' was not cancelled by this write'
  END
  FROM (SELECT payload ->> 'meeting' AS id) w
  LEFT JOIN meeting.meeting m ON m.id = w.id;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('meeting:meeting:hold', 'meeting.holds(jsonb)', 'meeting'),
  ('meeting:meeting:cancel', 'meeting.cancels(jsonb)', 'meeting');

GRANT USAGE ON SCHEMA meeting TO cella_app, cella_rules;
GRANT SELECT, INSERT, UPDATE ON meeting.meeting TO cella_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON meeting.item TO cella_app;
GRANT SELECT ON meeting.meeting, meeting.item TO cella_rules;
