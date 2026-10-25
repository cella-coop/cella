CREATE SCHEMA document_membership;

-- A member's reading of a document's version, on a day: what joining asks
-- of a new member, to read the texts the co-op adopted. The version is
-- named by id and the member by address, with no foreign key into either
-- feat. A member reads a version once; a later version is read anew.
CREATE TABLE document_membership.reading (
  version text NOT NULL,
  member text NOT NULL,
  read date NOT NULL,
  PRIMARY KEY (version, member)
);

-- The texts each member is to read: every document's binding version, its
-- latest adoption, with the day they read it, or none.
CREATE VIEW document_membership.texts AS
SELECT m.address AS member, d.id AS document, d.title, a.version, a.adopted, r.read
FROM membership.member m
CROSS JOIN document.adopted a
JOIN document.document d ON d.id = a.document
LEFT JOIN document_membership.reading r ON r.version = a.version AND r.member = m.address;

-- document-membership:version:read — the member marks a version read
-- themselves, on the verdict date: one of their own, of a version that
-- exists.
CREATE FUNCTION document_membership.reads(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.member IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may mark only their own reading'
    WHEN NOT EXISTS (SELECT FROM document.version v WHERE v.id = p.version) THEN 'no version ' || coalesce(p.version, 'is named')
    WHEN NOT EXISTS (
      SELECT FROM document_membership.reading r WHERE r.version = p.version AND r.member = p.member AND r.read = cella.verdict_date()
    ) THEN p.member || '''s reading of ' || p.version || ' was not marked by this write'
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'version' AS version) p;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('document-membership:version:read', 'document_membership.reads(jsonb)', 'document-membership');

GRANT USAGE ON SCHEMA document_membership TO cella_app, cella_rules;
GRANT SELECT ON document_membership.reading, document_membership.texts TO cella_app, cella_rules;
GRANT INSERT, UPDATE (read) ON document_membership.reading TO cella_app;
