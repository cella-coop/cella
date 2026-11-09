-- task:body:save: every person its entry names as a contributor since the
-- last save holds `discuss` in the task's circle on the verdict date, as
-- core body's session asks of each at every update; the saver's own power
-- is circle-person's guard's, over the circle the payload names. Refused,
-- it names who does not and what would let them.
CREATE FUNCTION task.contributed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save names a contributor who holds no discuss in ' || (contributed.payload ->> 'circle') || ': '
      || string_agg(c, ', ' ORDER BY c) || '; a mandate granting it there, or saving without their edits, would allow it'
  FROM jsonb_array_elements_text(coalesce(contributed.payload -> 'contributors', '[]')) c
  WHERE NOT circle_person.may(c, 'discuss', NULL, contributed.payload ->> 'circle', cella.verdict_date())
  HAVING count(*) > 0;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('task:body:save', 'task.contributed(jsonb)', 'task');
