-- How each action that writes the file feat's schema applies to the state
-- before it (architecture.md, "Folds"), and the fold of the write it
-- publishes, which a graft's fold calls as its handler calls it.

-- What `storing` stored, in the write of entry `n`, by its actor on its
-- day: the file under the id `stored` names, of its class and about its
-- subject, with its type and size. A file of the co-op's own folds with
-- its name and its bytes, which its entry keeps in base64, as the member
-- signed them, and which must hash to the BLAKE3 the entry names; a
-- personal file's name and bytes, which its entry keeps as commitments,
-- the bytes' to their BLAKE3, fold as erasure leaves them, its name
-- `redacted` and its bytes null.
CREATE FUNCTION file.fold_storing(n bigint, uploader text, uploaded date, stored jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  class text := stored ->> 'class';
  part text := CASE class WHEN 'none' THEN 'shared' WHEN 'expense-receipt' THEN 'receipt' WHEN 'payroll' THEN 'contract' WHEN 'profile' THEN 'record' END;
  made text;
BEGIN
  IF part IS NULL THEN
    RAISE EXCEPTION 'file: entry % stores % of class %, which no part keeps', n, stored ->> 'file', coalesce(class, 'none named');
  END IF;
  IF class = 'none' THEN
    INSERT INTO file.file (id, class, subject, name, type, size, bytes, uploader, uploaded)
    VALUES (stored ->> 'file', class, NULL, stored ->> 'name', stored ->> 'type', (stored ->> 'size')::integer,
            decode(stored ->> 'bytes', 'base64'), uploader, uploaded)
    RETURNING encode(hash, 'hex') INTO made;
    IF made IS DISTINCT FROM stored ->> 'hash' THEN
      RAISE EXCEPTION 'file: entry % stores % hashing to %, but its bytes hash to %', n, stored ->> 'file', stored ->> 'hash', coalesce(made, 'nothing');
    END IF;
  ELSE
    PERFORM cella.commits('file.' || part || '.bytes', stored ->> 'subject', n, stored -> 'hash');
    INSERT INTO file.file (id, class, subject, name, type, size, bytes, uploader, uploaded)
    VALUES (stored ->> 'file', class, stored ->> 'subject',
            cella.commits('file.' || part || '.name', stored ->> 'subject', n, stored -> 'name'),
            stored ->> 'type', (stored ->> 'size')::integer, NULL, uploader, uploaded);
  END IF;
END
$$;

-- file:file:upload: the co-op's own file, uploaded by the entry's actor
-- on its day.
CREATE FUNCTION file.fold_upload(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT file.fold_storing((fold_upload.entry ->> 'n')::bigint, fold_upload.entry ->> 'actor',
                           (fold_upload.entry ->> 'date')::date, fold_upload.entry -> 'payload');
END;

SELECT cella.lets_fold('file:file:upload', 1, 'file.fold_upload(jsonb)', 'file');
