-- What a motion may decide of documents, registered with the motion
-- feat so its New form offers it: adopting a version, picked from the
-- versions this graft adds to the form (`options`).
SELECT motion.register_carries('adopt', 'Adopt a document version', '[{"name": "version", "label": "Version", "type": "text", "options": "versions"}]', 'document:document:adopt', 'document-motion');

-- An action to adopt a version asks to adopt its document's content as
-- that version holds it: the adoption names the content by the hash the
-- database gave the version, so the members consent to content, not to
-- a row. A version that does not exist is refused, whatever wrote it.
CREATE FUNCTION document_motion.moved() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind <> 'adopt' THEN
    RETURN NEW;
  END IF;
  INSERT INTO document_motion.adoption (motion, document, version, hash)
  SELECT NEW.motion, v.document, v.id, v.hash FROM document.version v WHERE v.id = NEW.args ->> 'version';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no version %', coalesce(NEW.args ->> 'version', 'is named')
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER adopts AFTER INSERT ON motion.action
  FOR EACH ROW EXECUTE FUNCTION document_motion.moved();

-- motion:motion:propose — each action to adopt names a version, and
-- the motion asks to adopt that version's document as it hashes.
CREATE FUNCTION document_motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN v.id IS NULL THEN 'no version ' || coalesce(m.args ->> 'version', 'is named') || ' to adopt'
      WHEN a.motion IS NULL OR a.hash <> v.hash THEN m.motion || ' does not adopt ' || v.id || ' as it hashes'
    END AS r
    FROM motion.action m
    LEFT JOIN document.version v ON v.id = m.args ->> 'version'
    LEFT JOIN document_motion.adoption a ON a.motion = m.motion AND a.document = v.document AND a.version = v.id
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'adopt'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:propose', 'document_motion.asks(jsonb)', 'document-motion');
