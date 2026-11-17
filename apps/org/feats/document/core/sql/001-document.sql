CREATE SCHEMA document;

CREATE TABLE document.document (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY,
  title text NOT NULL
);

-- The draft's history: Loro updates, appended in receipt order and merged
-- in any. The live text is their merge; the server keeps and relays them.
-- One write may append several, as a close whose effects generate a
-- document twice: `n` orders them within it.
-- An update carried over from before the log has no author.
CREATE TABLE document.update (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  n bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt bigint NOT NULL,
  document text NOT NULL REFERENCES document.document,
  author text,
  at date NOT NULL,
  bytes bytea NOT NULL
);

CREATE INDEX ON document.update (document);

-- A version: the document at a Loro frontier, as a Loro snapshot of it,
-- with the frontier and its version vector. Its canonical JSON (RFC 8785),
-- its BLAKE3 hash and its plain text are the database's, computed from
-- the snapshot by the cella extension, never taken from a client.
-- Numbered per document, `<document>@<n>`; immutable.
CREATE TABLE document.version (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY,
  document text NOT NULL REFERENCES document.document,
  n integer NOT NULL CHECK (n > 0),
  saved date NOT NULL,
  snapshot bytea NOT NULL,
  canonical text NOT NULL GENERATED ALWAYS AS (cella.document_canonical(snapshot)) STORED,
  hash bytea NOT NULL GENERATED ALWAYS AS (cella.document_hash(snapshot)) STORED,
  plain text NOT NULL GENERATED ALWAYS AS (cella.document_text(snapshot)) STORED,
  frontier jsonb NOT NULL,
  vv jsonb NOT NULL,
  UNIQUE (document, n),
  CHECK (id = document || '@' || n)
);

-- A comment on a version: on the document as a whole, quoting nothing, or
-- on the text it quotes, anchored where one block holds it by Loro cursors
-- at the quote's ends (`{ block, from, to }`, each cursor in base64), which
-- find the quote in the draft however the text around it moves. Only a
-- quote is anchored.
CREATE TABLE document.comment (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version text NOT NULL REFERENCES document.version,
  author text NOT NULL,
  at date NOT NULL,
  quote text CHECK (quote <> ''),
  anchor jsonb CHECK (anchor IS NULL OR (quote IS NOT NULL AND anchor ? 'block' AND anchor ? 'from' AND anchor ? 'to')),
  text text NOT NULL,
  resolved boolean NOT NULL DEFAULT false
);

CREATE INDEX ON document.comment (version);

-- An adoption makes a version the document's binding text. It names the
-- adopted version it replaces, its base; `document.adopts` refuses it if
-- the adopted version moved since. Ordered by receipt, then by `n`, since
-- one write may adopt twice, as a close whose effects generate a document
-- twice.
CREATE TABLE document.adoption (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  n bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt bigint NOT NULL,
  document text NOT NULL REFERENCES document.document,
  version text NOT NULL,
  base text,
  adopted date NOT NULL
);

CREATE INDEX ON document.adoption (document);

-- Each document's binding version: its latest adoption.
CREATE VIEW document.adopted WITH (security_invoker = true) AS
  SELECT DISTINCT ON (a.document) a.document, a.version, a.adopted, a.receipt
  FROM document.adoption a
  ORDER BY a.document, a.receipt DESC, a.n DESC;

-- Numbers a version next in its document, under a lock on the document so
-- two saves cannot take one number. A version carried over from before the
-- log names its number. It runs with its owner's rights, since the app may
-- not lock a document's row itself.
CREATE FUNCTION document.numbers() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  PERFORM FROM document.document d WHERE d.id = NEW.document FOR UPDATE;
  IF NEW.n IS NULL THEN
    SELECT coalesce(max(v.n), 0) + 1 INTO NEW.n FROM document.version v WHERE v.document = NEW.document;
  END IF;
  NEW.id := NEW.document || '@' || NEW.n;
  RETURN NEW;
END
$$;

CREATE TRIGGER numbers BEFORE INSERT ON document.version
  FOR EACH ROW EXECUTE FUNCTION document.numbers();

-- Versions, updates and adoptions never change; a comment changes only by
-- being resolved.
CREATE FUNCTION document.permanent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'a document''s % never changes', TG_TABLE_NAME
    USING ERRCODE = 'triggered_action_exception';
END
$$;

CREATE TRIGGER permanent BEFORE UPDATE OR DELETE ON document.version
  FOR EACH ROW EXECUTE FUNCTION document.permanent();
CREATE TRIGGER permanent BEFORE UPDATE OR DELETE ON document.update
  FOR EACH ROW EXECUTE FUNCTION document.permanent();
CREATE TRIGGER permanent BEFORE UPDATE OR DELETE ON document.adoption
  FOR EACH ROW EXECUTE FUNCTION document.permanent();

-- A comment's quote, where it has one, is text its version holds.
CREATE FUNCTION document.quotes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quote IS NOT NULL AND NOT EXISTS (SELECT FROM document.version v WHERE v.id = NEW.version AND strpos(v.plain, NEW.quote) > 0) THEN
    RAISE EXCEPTION '% does not hold the quoted text', NEW.version
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER quotes BEFORE INSERT ON document.comment
  FOR EACH ROW EXECUTE FUNCTION document.quotes();

-- document:document:adopt — the write's adoption names a version of its
-- document, later than the one it replaces, and its base is the version
-- the latest adoption before it made binding: two adoptions from one base
-- cannot both settle. Edits to the draft never refuse it. A write's
-- adoption is the one at its receipt of the document and version it
-- names, since one write may adopt twice (`n`).
CREATE FUNCTION document.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN a.receipt IS NULL
      THEN 'no adoption of ' || coalesce(p.version, 'a version') || ' at receipt ' || coalesce(p.receipt::text, 'none')
    WHEN v.id IS NULL THEN a.document || ' has no version ' || a.version
    WHEN latest.version IS DISTINCT FROM a.base
      THEN a.document || ' moved: its adopted version is ' || coalesce(latest.version, 'none') || ', not ' || coalesce(a.base, 'none')
    WHEN v.n <= latest.n THEN a.version || ' is not later than ' || latest.version
  END
  FROM (SELECT (payload ->> 'receipt')::bigint AS receipt, payload ->> 'document' AS document, payload ->> 'version' AS version) p
  LEFT JOIN LATERAL (
    SELECT x.receipt, x.n, x.document, x.version, x.base FROM document.adoption x
    WHERE x.receipt = p.receipt AND x.document = p.document AND x.version = p.version
    ORDER BY x.n DESC
    LIMIT 1
  ) a ON true
  LEFT JOIN document.version v ON v.id = a.version AND v.document = a.document
  LEFT JOIN LATERAL (
    SELECT b.version, bv.n FROM document.adoption b
    JOIN document.version bv ON bv.id = b.version
    WHERE b.document = a.document AND (b.receipt, b.n) < (a.receipt, a.n)
    ORDER BY b.receipt DESC, b.n DESC
    LIMIT 1
  ) latest ON true;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('document:document:adopt', 'document.adopts(jsonb)', 'document');

GRANT USAGE ON SCHEMA document TO cella_app, cella_guards;
GRANT SELECT ON ALL TABLES IN SCHEMA document TO cella_app, cella_guards;
GRANT INSERT ON document.update, document.version, document.comment, document.adoption TO cella_app;
GRANT UPDATE (resolved) ON document.comment TO cella_app;

-- An update, a version and an adoption are in their document's circle,
-- and a comment in its version's, copied as each is made.
CREATE FUNCTION document.in_its_circle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'comment' THEN
    NEW.circle := coalesce((SELECT v.circle FROM document.version v WHERE v.id = NEW.version), NEW.circle);
  ELSE
    NEW.circle := coalesce((SELECT d.circle FROM document.document d WHERE d.id = NEW.document), NEW.circle);
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER in_its_circle BEFORE INSERT ON document.update
  FOR EACH ROW EXECUTE FUNCTION document.in_its_circle();

CREATE TRIGGER in_its_circle BEFORE INSERT ON document.version
  FOR EACH ROW EXECUTE FUNCTION document.in_its_circle();

CREATE TRIGGER in_its_circle BEFORE INSERT ON document.comment
  FOR EACH ROW EXECUTE FUNCTION document.in_its_circle();

CREATE TRIGGER in_its_circle BEFORE INSERT ON document.adoption
  FOR EACH ROW EXECUTE FUNCTION document.in_its_circle();
