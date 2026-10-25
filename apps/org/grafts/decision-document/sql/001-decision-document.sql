CREATE SCHEMA decision_document;

-- What a decision asks to adopt: a document's content, named by its
-- canonical hash (the BLAKE3 of the version's canonical JSON), and the
-- version the proposer read it in. The decision is named by id and the
-- document and version by theirs, with no foreign key into either feat.
CREATE TABLE decision_document.adoption (
  decision text NOT NULL,
  document text NOT NULL,
  version text NOT NULL,
  hash bytea NOT NULL CHECK (length(hash) = 32),
  PRIMARY KEY (decision, document)
);

-- document:document:adopt — the cited decision asks to adopt this
-- document, and the version adopted hashes as the decision names it: the
-- members voted on that content, whichever version holds it. That it
-- closed and passed on its roll is circle-decision-membership's rule,
-- attached through decision.cites; that the version is the document's
-- and its base has not moved, the document feat's.
CREATE FUNCTION decision_document.adopts(payload jsonb) RETURNS text
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

INSERT INTO cella.rule (op, fn, owner) VALUES ('document:document:adopt', 'decision_document.adopts(jsonb)', 'decision-document');
INSERT INTO decision.cites (op, owner) VALUES ('document:document:adopt', 'decision-document');

GRANT USAGE ON SCHEMA decision_document TO cella_app, cella_rules;
GRANT SELECT, INSERT ON decision_document.adoption TO cella_app;
GRANT SELECT ON decision_document.adoption TO cella_rules;
