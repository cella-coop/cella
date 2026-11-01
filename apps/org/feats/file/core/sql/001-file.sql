CREATE SCHEMA file;

CREATE SEQUENCE file.number;

-- The most a file may hold: 10 MiB, a scanned receipt or a signed
-- contract many times over.
CREATE FUNCTION file.largest() RETURNS integer
LANGUAGE sql IMMUTABLE
RETURN 10485760;

-- A file the co-op keeps: its name and media type as they were uploaded,
-- its size and its bytes, named by their BLAKE3, which anyone holding the
-- file can compute again; who uploaded it and on what day. `class` is the
-- retention class of the personal data it holds, `none` for the co-op's
-- own, and `subject` whose data it is. A file never changes: only the
-- notary's redaction empties its name and bytes, and its hash with them.
-- What it is attached to is the graft's that attaches it.
CREATE TABLE file.file (
  id text NOT NULL DEFAULT 'fi-' || lpad(nextval('file.number')::text, 4, '0'),
  class text NOT NULL CHECK (class IN ('none', 'expense-receipt', 'payroll', 'profile')),
  subject text,
  name text NOT NULL CHECK (name <> ''),
  type text NOT NULL CHECK (type ~ '^[a-z]+/[a-z0-9.+-]+$'),
  size integer NOT NULL CHECK (size > 0 AND size <= file.largest()),
  bytes bytea,
  hash bytea GENERATED ALWAYS AS (cella.digest(bytes)) STORED,
  uploader text NOT NULL,
  uploaded date NOT NULL,
  PRIMARY KEY (id, class),
  CHECK ((class = 'none') = (subject IS NULL)),
  CHECK (bytes IS NULL OR octet_length(bytes) = size)
) PARTITION BY LIST (class);

-- One part for each class, so that each registers its personal columns
-- under its own class and erasure redacts them by it: the co-op's own
-- files, receipts, employment records and member records.
CREATE TABLE file.shared PARTITION OF file.file FOR VALUES IN ('none');
CREATE TABLE file.receipt PARTITION OF file.file FOR VALUES IN ('expense-receipt');
CREATE TABLE file.contract PARTITION OF file.file FOR VALUES IN ('payroll');
CREATE TABLE file.record PARTITION OF file.file FOR VALUES IN ('profile');

CREATE INDEX ON file.file (hash);
CREATE INDEX ON file.file (subject);

-- A file never changes, but by the notary's redaction.
CREATE FUNCTION file.fixed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cella.redacting() THEN
    RAISE EXCEPTION '% never changes once uploaded', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER fixed BEFORE UPDATE ON file.file
  FOR EACH ROW EXECUTE FUNCTION file.fixed();

-- Whether a member may open a file's bytes by its own guard: the co-op's
-- own files anyone may; a personal file, the person it concerns and who
-- uploaded it. A graft that sees a power over what the file is attached
-- to may open it to more.
CREATE FUNCTION file.opens(id text, actor text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(bool_or(f.class = 'none' OR opens.actor IN (f.subject, f.uploader)), false)
  FROM file.file f WHERE f.id = opens.id;
END;

-- Why a file is not the one a write says it stored, or null: uploaded by
-- the actor on the verdict date, of the class and about the subject the
-- write names, and holding its bytes. Each graft that attaches a file
-- checks it so.
CREATE FUNCTION file.stored(id text, class text, subject text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN f.id IS NULL THEN 'no file ' || coalesce(x.id, 'is named')
    WHEN f.uploader IS DISTINCT FROM cella.actor() OR f.uploaded IS DISTINCT FROM cella.verdict_date()
      THEN f.id || ' was not uploaded by this write'
    WHEN f.class IS DISTINCT FROM x.class THEN f.id || ' is of class ' || f.class || ', not ' || coalesce(x.class, 'none named')
    WHEN f.subject IS DISTINCT FROM x.subject THEN f.id || ' concerns ' || coalesce(f.subject, 'no one') || ', not ' || coalesce(x.subject, 'no one')
    WHEN f.bytes IS NULL THEN f.id || ' holds nothing'
  END
  FROM (SELECT stored.id, stored.class, stored.subject) x
  LEFT JOIN file.file f ON f.id = x.id;
END;

-- file:file:upload — a file of the co-op's own, uploaded by the actor on
-- the verdict date; a personal file comes in through the graft that
-- attaches it, under that graft's guard.
CREATE FUNCTION file.uploads(payload jsonb) RETURNS text
LANGUAGE sql STABLE
RETURN file.stored(payload ->> 'file', 'none', NULL);

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('file:file:upload', 'file.uploads(jsonb)', 'file');

-- Uploading a file is every person's right; file.uploads checks it is
-- theirs, uploaded by this write.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('file:file:upload', 'upload-file', NULL, 'file');

GRANT USAGE ON SCHEMA file TO cella_app, cella_guards;
GRANT SELECT ON file.file, file.shared, file.receipt, file.contract, file.record TO cella_app, cella_guards;
GRANT INSERT ON file.file TO cella_app;
GRANT USAGE ON SEQUENCE file.number TO cella_app;
