-- project's body: its free-form content, a Loro snapshot of core body's
-- blocks, set by each save an editor's browser signs, and always one with
-- a canonical form. Saving it needs `discuss` in its circle, which every
-- seat there holds. Written by `cella scaffold body project`.
ALTER TABLE project.project ADD COLUMN body bytea CHECK (body IS NULL OR cella.document_canonical(body) IS NOT NULL);

GRANT UPDATE (body) ON project.project TO cella_app;

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('project:body:save', 'discuss', NULL, 'project');

-- project:body:save: every person its entry names as a contributor since the
-- last save holds `discuss` in the project's circle on the verdict date, as
-- core body's session asks of each at every update; the saver's own power
-- is circle-person's guard's, over the circle the payload names. Refused,
-- it names who does not and what would let them.
CREATE FUNCTION project.contributed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save names a contributor who holds no discuss in ' || (contributed.payload ->> 'circle') || ': '
      || string_agg(c, ', ' ORDER BY c) || '; a mandate granting it there, or saving without their edits, would allow it'
  FROM jsonb_array_elements_text(coalesce(contributed.payload -> 'contributors', '[]')) c
  WHERE NOT circle_person.may(c, 'discuss', NULL, contributed.payload ->> 'circle', cella.verdict_date())
  HAVING count(*) > 0;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('project:body:save', 'project.contributed(jsonb)', 'project');

-- project:body:save: the body set to the snapshot its entry carries, in hex.
CREATE FUNCTION project.fold_body_save(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE project.project SET body = decode(fold_body_save.entry -> 'payload' ->> 'snapshot', 'hex')
  WHERE id = fold_body_save.entry -> 'payload' ->> 'project';
END;

SELECT cella.lets_fold('project:body:save', 1, 'project.fold_body_save(jsonb)', 'project');
