-- How each action of file-membership applies to the state before it
-- (architecture.md, "Folds").

-- file-membership:member:attach: the record stored about the member by
-- the file feat's fold of the write its handler called, `storing`, as
-- its entry keeps it, then kept on the member's file.
CREATE FUNCTION file_membership.fold_attach(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM file.fold_storing((entry ->> 'n')::bigint, entry ->> 'actor', (entry ->> 'date')::date, p);
  INSERT INTO file_membership.record (member, file) VALUES (p ->> 'member', p ->> 'file');
END
$$;

SELECT cella.lets_fold('file-membership:member:attach', 1, 'file_membership.fold_attach(jsonb)', 'file-membership');
