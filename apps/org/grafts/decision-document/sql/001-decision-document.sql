CREATE SCHEMA decision_document;

-- A version a decision asks to adopt. The decision is named by id and the
-- document and version by theirs, with no foreign key into either feat.
CREATE TABLE decision_document.adoption (
  decision text NOT NULL,
  document text NOT NULL,
  version text NOT NULL,
  PRIMARY KEY (decision, document)
);

-- document:document:adopt — the cited decision asks to adopt this version
-- of this document. That it closed and passed on its roll is
-- circle-decision-member's rule, attached through decision.cites; that the
-- version is the document's and its base has not moved, the document
-- feat's.
CREATE FUNCTION decision_document.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM decision_document.adoption a
      WHERE a.decision = d.id AND a.document = p.document AND a.version = p.version
    ) THEN d.id || ' does not adopt ' || coalesce(p.version, 'a version')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'document' AS document, payload ->> 'version' AS version) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('document:document:adopt', 'decision_document.adopts(jsonb)', 'decision-document');
INSERT INTO decision.cites (op, owner) VALUES ('document:document:adopt', 'decision-document');

GRANT USAGE ON SCHEMA decision_document TO cella_app, cella_rules;
GRANT SELECT, INSERT ON decision_document.adoption TO cella_app;
GRANT SELECT ON decision_document.adoption TO cella_rules;
