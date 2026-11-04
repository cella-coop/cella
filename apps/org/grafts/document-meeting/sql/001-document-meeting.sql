CREATE SCHEMA document_meeting;

-- A meeting's minutes: the document they are written in, by the
-- meeting's id and the document's, with no foreign key into either feat.
-- A meeting has one set of minutes and a document minutes one meeting.
CREATE TABLE document_meeting.minutes (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  meeting text PRIMARY KEY,
  document text NOT NULL UNIQUE
);

-- Both sides resolve: the meeting and the document exist.
CREATE FUNCTION document_meeting.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM meeting.meeting m WHERE m.id = NEW.meeting) THEN
    RAISE EXCEPTION 'no meeting %', NEW.meeting USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM document.document d WHERE d.id = NEW.document) THEN
    RAISE EXCEPTION 'no document %', NEW.document USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON document_meeting.minutes
  FOR EACH ROW EXECUTE FUNCTION document_meeting.resolves();

-- meeting:meeting:minute — the minutes the write names are the meeting's.
CREATE FUNCTION document_meeting.keeps(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.document IS NOT NULL AND n.document IS DISTINCT FROM w.document
      THEN coalesce(w.meeting, 'no meeting') || '''s minutes are not ' || w.document
  END
  FROM (SELECT payload ->> 'meeting' AS meeting, payload ->> 'document' AS document) w
  LEFT JOIN document_meeting.minutes n ON n.meeting = w.meeting;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('meeting:meeting:minute', 'document_meeting.keeps(jsonb)', 'document-meeting');

GRANT USAGE ON SCHEMA document_meeting TO cella_app, cella_guards;
GRANT SELECT, INSERT ON document_meeting.minutes TO cella_app;
GRANT SELECT ON document_meeting.minutes TO cella_guards;
