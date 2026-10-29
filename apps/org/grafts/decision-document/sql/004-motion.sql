-- Writes stay home: what a decision asks to adopt is its motion, which
-- the decision feat writes, so this graft reads it rather than copying it
-- by a trigger on `decision.motion`. A version never changes, so the hash
-- the database gave it is the content the members consent to, read as
-- the motion names it. That the motion names a version is `asks`, the
-- rule on the proposal.
DROP TRIGGER adopts ON decision.motion;
DROP FUNCTION decision_document.moved();

ALTER TABLE decision_document.adoption RENAME TO recorded;

-- What a decision asks to adopt: a document's content, named by its
-- canonical hash, and the version the proposer read it in. One row a
-- motion of the `adopt` kind that names a version.
CREATE VIEW decision_document.adoption AS
SELECT m.decision, v.document, v.id AS version, v.hash
FROM decision.motion m
JOIN document.version v ON v.id = m.args ->> 'version'
WHERE m.kind = 'adopt';

-- document:document:adopt — the cited decision asks to adopt this
-- document, and the version adopted hashes as the decision names it: the
-- members voted on that content, whichever version holds it. That it
-- closed and passed on its roll is circle-decision-membership's rule,
-- attached through decision.cites; that the version is the document's
-- and its base has not moved, the document feat's.
CREATE OR REPLACE FUNCTION decision_document.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN a.decision IS NULL THEN d.id || ' does not adopt ' || coalesce(p.document, 'a document')
    WHEN v.id IS NULL THEN p.document || ' has no version ' || coalesce(p.version, 'named')
    WHEN v.hash <> a.hash
      THEN d.id || ' adopts ' || a.document || ' as ' || left(encode(a.hash, 'hex'), 12) || ', not '
        || v.id || ', which hashes ' || left(encode(v.hash, 'hex'), 12)
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'document' AS document, payload ->> 'version' AS version) p
  LEFT JOIN decision.decision d ON d.id = p.decision
  LEFT JOIN decision_document.adoption a ON a.decision = d.id AND a.document = p.document
  LEFT JOIN document.version v ON v.id = p.version AND v.document = p.document;
END;

-- decision:decision:propose — each motion to adopt names a version, and
-- no two of a decision's name versions of one document.
CREATE OR REPLACE FUNCTION decision_document.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN v.id IS NULL THEN 'no version ' || coalesce(m.args ->> 'version', 'is named') || ' to adopt'
      WHEN count(*) OVER (PARTITION BY v.document) > 1 THEN m.decision || ' moves to adopt ' || v.document || ' twice'
    END AS r
    FROM decision.motion m
    LEFT JOIN document.version v ON v.id = m.args ->> 'version'
    WHERE m.decision = payload ->> 'decision' AND m.kind = 'adopt'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

DROP TABLE decision_document.recorded;

GRANT SELECT ON decision_document.adoption TO cella_app, cella_rules;
