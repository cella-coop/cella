CREATE SCHEMA document_motion;

-- What a motion asks to adopt: a document's content, named by its
-- canonical hash (the BLAKE3 of the version's canonical JSON), and the
-- version the proposer read it in. The motion is named by id and the
-- document and version by theirs, with no foreign key into either feat.
CREATE TABLE document_motion.adoption (
  motion text NOT NULL,
  document text NOT NULL,
  version text NOT NULL,
  hash bytea NOT NULL CHECK (length(hash) = 32),
  PRIMARY KEY (motion, document)
);

-- document:document:adopt — the cited motion asks to adopt this
-- document, and the version adopted hashes as the motion names it: the
-- members voted on that content, whichever version holds it. That it
-- closed and passed on its roll is membership-motion's guard,
-- attached through motion.cites; that the version is the document's
-- and its base has not moved, the document feat's.
CREATE FUNCTION document_motion.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN a.motion IS NULL THEN d.id || ' does not adopt ' || coalesce(p.document, 'a document')
    WHEN v.id IS NULL THEN p.document || ' has no version ' || coalesce(p.version, 'named')
    WHEN v.hash <> a.hash
      THEN d.id || ' adopts ' || a.document || ' as ' || left(encode(a.hash, 'hex'), 12) || ', not '
        || v.id || ', which hashes ' || left(encode(v.hash, 'hex'), 12)
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'document' AS document, payload ->> 'version' AS version) p
  LEFT JOIN motion.motion d ON d.id = p.motion
  LEFT JOIN document_motion.adoption a ON a.motion = d.id AND a.document = p.document
  LEFT JOIN document.version v ON v.id = p.version AND v.document = p.document;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('document:document:adopt', 'document_motion.adopts(jsonb)', 'document-motion');
SELECT motion.register_cite('document:document:adopt', 'adopt-document', 'document-motion');

GRANT USAGE ON SCHEMA document_motion TO cella_app, cella_guards;
GRANT SELECT, INSERT ON document_motion.adoption TO cella_app;
GRANT SELECT ON document_motion.adoption TO cella_guards;
