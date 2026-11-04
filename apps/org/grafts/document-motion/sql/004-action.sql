-- Writes stay home: what a motion asks to adopt is its action, which
-- the motion feat writes, so this graft reads it rather than copying it
-- by a trigger on `motion.action`. A version never changes, so the hash
-- the database gave it is the content the members consent to, read as
-- the action names it. That the action names a version is `asks`, the
-- guard on the proposal.
DROP TRIGGER adopts ON motion.action;
DROP FUNCTION document_motion.moved();

ALTER TABLE document_motion.adoption RENAME TO recorded;

-- What a motion asks to adopt: a document's content, named by its
-- canonical hash, and the version the proposer read it in. One row a
-- action of the `adopt` kind that names a version.
CREATE VIEW document_motion.adoption AS
SELECT m.motion, v.document, v.id AS version, v.hash
FROM motion.action m
JOIN document.version v ON v.id = m.args ->> 'version'
WHERE m.kind = 'adopt';

-- document:document:adopt — the cited motion asks to adopt this
-- document, and the version adopted hashes as the motion names it: the
-- members voted on that content, whichever version holds it. That it
-- closed and passed on its roll is membership-motion's guard,
-- attached through motion.cites; that the version is the document's
-- and its base has not moved, the document feat's.
CREATE OR REPLACE FUNCTION document_motion.adopts(payload jsonb) RETURNS text
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

-- motion:motion:propose — each action to adopt names a version, and
-- no two of a motion's name versions of one document.
CREATE OR REPLACE FUNCTION document_motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN v.id IS NULL THEN 'no version ' || coalesce(m.args ->> 'version', 'is named') || ' to adopt'
      WHEN count(*) OVER (PARTITION BY v.document) > 1 THEN m.motion || ' moves to adopt ' || v.document || ' twice'
    END AS r
    FROM motion.action m
    LEFT JOIN document.version v ON v.id = m.args ->> 'version'
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'adopt'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

DROP TABLE document_motion.recorded;

GRANT SELECT ON document_motion.adoption TO cella_app, cella_guards;
