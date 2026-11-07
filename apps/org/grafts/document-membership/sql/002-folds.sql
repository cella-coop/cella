-- How each action of document-membership applies to the state before it
-- (architecture.md, "Folds").

-- document-membership:version:read: the member's reading of the version,
-- on the entry's day; one marked already keeps its first day, as its
-- handler keeps it.
CREATE FUNCTION document_membership.fold_read(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO document_membership.reading (version, member, read)
  VALUES (fold_read.entry -> 'payload' ->> 'version', fold_read.entry -> 'payload' ->> 'member', (fold_read.entry ->> 'date')::date)
  ON CONFLICT (version, member) DO NOTHING;
END;

SELECT cella.lets_fold('document-membership:version:read', 1, 'document_membership.fold_read(jsonb)', 'document-membership');
