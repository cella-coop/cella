-- How each action that writes the document feat's schema applies to the
-- state before it (architecture.md, "Folds"): a document's text, each
-- update's bytes and each version's snapshot, frontier and version
-- vector, as the entry carries them in hex, so the fold rebuilds every
-- row, the generated columns of a version computed from its snapshot as
-- they were; a comment's text as its commitment.

-- An update appended on the entry's day by its actor, under the number and
-- at the receipt the entry names, its bytes the entry's; bytes whose digest
-- is not the entry's refuse.
CREATE FUNCTION document.fold_update(n bigint, actor text, day date, document text, p jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  bytes bytea := decode(p ->> 'update', 'hex');
BEGIN
  IF p ? 'digest' AND encode(cella.digest(bytes), 'hex') IS DISTINCT FROM p ->> 'digest' THEN
    RAISE EXCEPTION 'document: entry % appends an update to % digested %, where its bytes digest %',
      fold_update.n, fold_update.document, p ->> 'digest', encode(cella.digest(bytes), 'hex');
  END IF;
  INSERT INTO document.update (n, receipt, document, author, at, bytes) OVERRIDING SYSTEM VALUE
  VALUES ((p ->> 'appended')::bigint, (p ->> 'receipt')::bigint, fold_update.document, fold_update.actor, fold_update.day, bytes);
END
$$;

-- A version saved on the entry's day, under the number the entry names,
-- its snapshot, frontier and version vector the entry's; a snapshot the
-- database hashes otherwise than the entry refuses, naming both.
CREATE FUNCTION document.fold_saved(n bigint, day date, document text, p jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  hashed text;
BEGIN
  INSERT INTO document.version (document, n, saved, snapshot, frontier, vv)
  VALUES (fold_saved.document, (p ->> 'n')::integer, fold_saved.day, decode(p ->> 'snapshot', 'hex'), p -> 'frontier', p -> 'vv')
  RETURNING encode(hash, 'hex') INTO hashed;
  IF hashed IS DISTINCT FROM p ->> 'hash' THEN
    RAISE EXCEPTION 'document: entry % saves % hashed %, where the fold hashes it %', fold_saved.n, p ->> 'version', p ->> 'hash', hashed;
  END IF;
END
$$;

-- A document started as `creating` started it, from the entry carrying
-- its creation: under its id, with its title, in its circle, and its
-- opening update, where it has one, as its actor's. Published for a slice
-- whose own write starts a document by `creating`, as document-meeting's
-- minutes do, to fold from its entry.
CREATE FUNCTION document.fold_creating(n bigint, actor text, day date, p jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO document.document (id, title, circle) VALUES (p ->> 'document', p ->> 'title', p ->> 'circle');
  IF p ->> 'update' IS NOT NULL THEN
    PERFORM document.fold_update(fold_creating.n, fold_creating.actor, fold_creating.day, p ->> 'document', p);
  END IF;
END
$$;

-- document:document:create: the document its entry starts, by
-- `document.fold_creating`.
CREATE FUNCTION document.fold_create(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT document.fold_creating((fold_create.entry ->> 'n')::bigint, fold_create.entry ->> 'actor',
                                (fold_create.entry ->> 'date')::date, fold_create.entry -> 'payload');
END;

-- document:document:edit: the update its entry appends.
CREATE FUNCTION document.fold_edit(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT document.fold_update((fold_edit.entry ->> 'n')::bigint, fold_edit.entry ->> 'actor', (fold_edit.entry ->> 'date')::date,
                              fold_edit.entry -> 'payload' ->> 'document', fold_edit.entry -> 'payload');
END;

-- document:document:version: the version its entry saves.
CREATE FUNCTION document.fold_version(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT document.fold_saved((fold_version.entry ->> 'n')::bigint, (fold_version.entry ->> 'date')::date,
                             fold_version.entry -> 'payload' ->> 'document', fold_version.entry -> 'payload');
END;

-- document:document:comment: the comment under the id its entry names, by
-- its actor on its day, on the text it quotes and anchored where the entry
-- says, its text as its commitment; `document.quotes` refuses a quote the
-- folded version does not hold, as it did when it was made.
CREATE FUNCTION document.fold_comment(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO document.comment (id, version, author, at, quote, anchor, text) OVERRIDING SYSTEM VALUE
  VALUES ((p ->> 'comment')::bigint, p ->> 'version', entry ->> 'actor', (entry ->> 'date')::date, p ->> 'quote',
          nullif(p -> 'anchor', 'null'::jsonb),
          cella.commits('document.comment.text', entry ->> 'actor', (entry ->> 'n')::bigint, p -> 'text'));
END
$$;

-- An adoption on the entry's day, under the number and at the receipt the
-- entry names, from the base it names; a version that hashes otherwise
-- than the entry refuses, naming both.
CREATE FUNCTION document.fold_adoption(n bigint, day date, p jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  hashed text := (SELECT encode(v.hash, 'hex') FROM document.version v WHERE v.id = p ->> 'version' AND v.document = p ->> 'document');
BEGIN
  IF hashed IS DISTINCT FROM p ->> 'hash' THEN
    RAISE EXCEPTION 'document: entry % adopts % hashed %, where the fold holds it hashed %',
      fold_adoption.n, p ->> 'version', p ->> 'hash', coalesce(hashed, 'none');
  END IF;
  INSERT INTO document.adoption (n, receipt, document, version, base, adopted) OVERRIDING SYSTEM VALUE
  VALUES ((p ->> 'adoption')::bigint, (p ->> 'receipt')::bigint, p ->> 'document', p ->> 'version', p ->> 'base', fold_adoption.day);
END
$$;

-- document:document:adopt: the adoption its entry makes.
CREATE FUNCTION document.fold_adopt(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT document.fold_adoption((fold_adopt.entry ->> 'n')::bigint, (fold_adopt.entry ->> 'date')::date, fold_adopt.entry -> 'payload');
END;

-- document:document:generate: what the generation wrote, in its order: the
-- update, where the draft changed, the version, the motion and the day it
-- reads, as the entry carries them, and the version's adoption.
CREATE FUNCTION document.fold_generate(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  n bigint := (entry ->> 'n')::bigint;
  day date := (entry ->> 'date')::date;
BEGIN
  IF p ->> 'update' IS NOT NULL THEN
    PERFORM document.fold_update(n, entry ->> 'actor', day, p ->> 'document', p - 'digest');
  END IF;
  PERFORM document.fold_saved(n, day, p ->> 'document', p);
  INSERT INTO document.generation (document, version, motion, day)
  VALUES (p ->> 'document', p ->> 'version', p ->> 'motion', (p ->> 'reads')::date);
  PERFORM document.fold_adoption(n, day, p);
END
$$;

SELECT cella.lets_fold('document:document:create', 1, 'document.fold_create(jsonb)', 'document');
SELECT cella.lets_fold('document:document:edit', 1, 'document.fold_edit(jsonb)', 'document');
SELECT cella.lets_fold('document:document:version', 1, 'document.fold_version(jsonb)', 'document');
SELECT cella.lets_fold('document:document:comment', 1, 'document.fold_comment(jsonb)', 'document');
SELECT cella.lets_fold('document:document:adopt', 1, 'document.fold_adopt(jsonb)', 'document');
SELECT cella.lets_fold('document:document:generate', 1, 'document.fold_generate(jsonb)', 'document');
