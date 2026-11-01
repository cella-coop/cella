-- What a decision may decide of documents, registered with the decision
-- feat so its New form offers it: adopting a version, picked from the
-- versions this graft adds to the form (`options`).
INSERT INTO decision.kind (kind, label, fields, owner) VALUES
  ('adopt', 'Adopt a document version', '[{"name": "version", "label": "Version", "type": "text", "options": "versions"}]', 'decision-document');

-- A motion to adopt a version asks to adopt its document's content as
-- that version holds it: the adoption names the content by the hash the
-- database gave the version, so the members consent to content, not to
-- a row. A version that does not exist is refused, whatever wrote it.
CREATE FUNCTION decision_document.moved() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind <> 'adopt' THEN
    RETURN NEW;
  END IF;
  INSERT INTO decision_document.adoption (decision, document, version, hash)
  SELECT NEW.decision, v.document, v.id, v.hash FROM document.version v WHERE v.id = NEW.args ->> 'version';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no version %', coalesce(NEW.args ->> 'version', 'is named')
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER adopts AFTER INSERT ON decision.motion
  FOR EACH ROW EXECUTE FUNCTION decision_document.moved();

-- decision:decision:propose — each motion to adopt names a version, and
-- the decision asks to adopt that version's document as it hashes.
CREATE FUNCTION decision_document.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN v.id IS NULL THEN 'no version ' || coalesce(m.args ->> 'version', 'is named') || ' to adopt'
      WHEN a.decision IS NULL OR a.hash <> v.hash THEN m.decision || ' does not adopt ' || v.id || ' as it hashes'
    END AS r
    FROM decision.motion m
    LEFT JOIN document.version v ON v.id = m.args ->> 'version'
    LEFT JOIN decision_document.adoption a ON a.decision = m.decision AND a.document = v.document AND a.version = v.id
    WHERE m.decision = payload ->> 'decision' AND m.kind = 'adopt'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('decision:decision:propose', 'decision_document.asks(jsonb)', 'decision-document');
