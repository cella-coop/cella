-- The document a link in a motion's message names: a document by its
-- id, or the document of a version by the version's.
CREATE FUNCTION document_motion.linked(ref text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    (SELECT d.id FROM document.document d WHERE d.id = lower(ref)),
    (SELECT v.document FROM document.version v WHERE v.id = lower(ref))
  );
END;

-- motion:message:post — each link the message gives names a document or
-- one of its versions.
CREATE FUNCTION document_motion.links(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT '[[' || l.ref || ']] names no document'
  FROM jsonb_array_elements_text(coalesce(payload -> 'links', '[]')) AS l(ref)
  WHERE document_motion.linked(l.ref) IS NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:message:post', 'document_motion.links(jsonb)', 'document-motion');
