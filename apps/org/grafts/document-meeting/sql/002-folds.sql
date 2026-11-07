-- How the writes on which document-meeting writes its schema apply to the
-- state before them (architecture.md, "Folds"), after the meeting feat's
-- fold of the same entry.

-- meeting:meeting:minute: the first time, the document the minutes are
-- kept in, started by the document feat's `document.fold_creating` from
-- the creation the entry carries, and the minutes tied to the meeting;
-- after that, the minutes are the document already kept, and the entry
-- carries no creation.
CREATE FUNCTION document_meeting.fold_minute(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF p -> 'created' IS NULL OR jsonb_typeof(p -> 'created') = 'null' THEN
    RETURN;
  END IF;
  PERFORM document.fold_creating((entry ->> 'n')::bigint, entry ->> 'actor', (entry ->> 'date')::date, p -> 'created');
  INSERT INTO document_meeting.minutes (meeting, document) VALUES (p ->> 'meeting', p -> 'created' ->> 'document');
END
$$;

SELECT cella.lets_fold('meeting:meeting:minute', 1, 'document_meeting.fold_minute(jsonb)', 'document-meeting');
