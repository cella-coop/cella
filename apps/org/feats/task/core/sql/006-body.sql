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

-- task:body:save: the save's snapshot holds the body it replaces. Its
-- `base`, the hash of the saved body the browser merged, empty for none,
-- is `replaced`, the `encode(sha256(body), 'hex')` of the body the task
-- held, which the handler read under the row's lock in the save's own
-- transaction, since at the verdict the row holds the new one. Refused,
-- it names both and what would let it.
CREATE FUNCTION task.based(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save merged the body hashed ' || coalesce(nullif(based.payload ->> 'base', ''), 'none')
      || ', but the task held the one hashed ' || coalesce(nullif(based.payload ->> 'replaced', ''), 'none')
      || '; merging the saved body into the snapshot and saving again would allow it'
  WHERE coalesce(based.payload ->> 'base', '') <> coalesce(based.payload ->> 'replaced', '');
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('task:body:save', 'task.based(jsonb)', 'task');
