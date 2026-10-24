CREATE SCHEMA document;

CREATE TABLE document.document (
  id text PRIMARY KEY,
  title text NOT NULL
);

-- The draft's history: Loro updates, appended in receipt order and merged
-- in any. The live text is their merge; the server keeps and relays them.
-- An update carried over from before the log has no author.
CREATE TABLE document.update (
  receipt bigint PRIMARY KEY,
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

-- A comment on a version, on the text it quotes within one block, and
-- anchored there by Loro cursors at the quote's ends (`{ block, from, to }`,
-- each cursor in base64), which find the quote in the draft however the
-- text around it moves.
CREATE TABLE document.comment (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version text NOT NULL REFERENCES document.version,
  author text NOT NULL,
  at date NOT NULL,
  quote text NOT NULL CHECK (quote <> ''),
  anchor jsonb CHECK (anchor IS NULL OR (anchor ? 'block' AND anchor ? 'from' AND anchor ? 'to')),
  text text NOT NULL,
  resolved boolean NOT NULL DEFAULT false
);

CREATE INDEX ON document.comment (version);

-- An adoption makes a version the document's binding text. It names the
-- adopted version it replaces, its base; `document.adopts` refuses it if
-- the adopted version moved since. Ordered by receipt.
CREATE TABLE document.adoption (
  receipt bigint PRIMARY KEY,
  document text NOT NULL REFERENCES document.document,
  version text NOT NULL,
  base text,
  adopted date NOT NULL
);

CREATE INDEX ON document.adoption (document);

-- Each document's binding version: its latest adoption.
CREATE VIEW document.adopted AS
  SELECT DISTINCT ON (a.document) a.document, a.version, a.adopted, a.receipt
  FROM document.adoption a
  ORDER BY a.document, a.receipt DESC;

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

-- A comment quotes text its version holds.
CREATE FUNCTION document.quotes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM document.version v WHERE v.id = NEW.version AND strpos(v.plain, NEW.quote) > 0) THEN
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
-- cannot both settle. Edits to the draft never refuse it.
CREATE FUNCTION document.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN a.receipt IS NULL THEN 'no adoption at receipt ' || coalesce(p.receipt::text, 'none')
    WHEN a.document IS DISTINCT FROM p.document OR a.version IS DISTINCT FROM p.version
      THEN 'the adoption at receipt ' || a.receipt || ' is not this write''s'
    WHEN v.id IS NULL THEN a.document || ' has no version ' || a.version
    WHEN latest.version IS DISTINCT FROM a.base
      THEN a.document || ' moved: its adopted version is ' || coalesce(latest.version, 'none') || ', not ' || coalesce(a.base, 'none')
    WHEN v.n <= latest.n THEN a.version || ' is not later than ' || latest.version
  END
  FROM (SELECT (payload ->> 'receipt')::bigint AS receipt, payload ->> 'document' AS document, payload ->> 'version' AS version) p
  LEFT JOIN document.adoption a ON a.receipt = p.receipt
  LEFT JOIN document.version v ON v.id = a.version AND v.document = a.document
  LEFT JOIN LATERAL (
    SELECT b.version, bv.n FROM document.adoption b
    JOIN document.version bv ON bv.id = b.version
    WHERE b.document = a.document AND b.receipt < a.receipt
    ORDER BY b.receipt DESC
    LIMIT 1
  ) latest ON true;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('document:document:adopt', 'document.adopts(jsonb)', 'document');

GRANT USAGE ON SCHEMA document TO cella_app, cella_rules;
GRANT SELECT ON ALL TABLES IN SCHEMA document TO cella_app, cella_rules;
GRANT INSERT ON document.update, document.version, document.comment, document.adoption TO cella_app;
GRANT UPDATE (resolved) ON document.comment TO cella_app;
