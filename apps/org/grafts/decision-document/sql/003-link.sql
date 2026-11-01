-- The document a link in a decision's message names: a document by its
-- id, or the document of a version by the version's.
CREATE FUNCTION decision_document.linked(ref text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    (SELECT d.id FROM document.document d WHERE d.id = lower(ref)),
    (SELECT v.document FROM document.version v WHERE v.id = lower(ref))
  );
END;

-- decision:message:post — each link the message gives names a document or
-- one of its versions.
CREATE FUNCTION decision_document.links(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT '[[' || l.ref || ']] names no document'
  FROM jsonb_array_elements_text(coalesce(payload -> 'links', '[]')) AS l(ref)
  WHERE decision_document.linked(l.ref) IS NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('decision:message:post', 'decision_document.links(jsonb)', 'decision-document');
