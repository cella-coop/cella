CREATE SCHEMA key_member;

-- An invitation's first device: the public key the invitee's device made,
-- and the label they gave it, carried from the invitation to the admission
-- that enrols it. The member is named by address, with no foreign key into
-- either feat; the label is the invitee's own wording and stays out of the
-- log.
CREATE TABLE key_member.invitation (
  member text PRIMARY KEY,
  key bytea NOT NULL UNIQUE CHECK (length(key) = 32),
  label text NOT NULL CHECK (label <> '')
);

-- member:member:invite — the invitation carries a first device: the key
-- its payload names, which no device holds yet.
CREATE FUNCTION key_member.carries(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN i.member IS NULL THEN coalesce(p.member, 'no one') || ' is invited with no first device'
    WHEN encode(i.key, 'hex') IS DISTINCT FROM p.key THEN p.member || '''s invitation carries another key than its payload names'
    WHEN EXISTS (SELECT FROM key.device d WHERE d.key = i.key)
      THEN 'device ' || left(p.key, 16) || ' is enrolled already'
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'key' AS key) p
  LEFT JOIN key_member.invitation i ON i.member = p.member;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('member:member:invite', 'key_member.carries(jsonb)', 'key-member');

-- Admission enrols the invitation's device, in the admitting write's own
-- transaction: when a member moves from invited to active, their first
-- device is enrolled on the verdict date, enrolled by no device, as the
-- invitation carried it. An admission whose invitation carries no device
-- is refused with it, so no member is admitted unable to sign.
CREATE FUNCTION key_member.enrol() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO key.device (key, address, label, enrolled)
  SELECT i.key, i.member, i.label, cella.verdict_date()
  FROM key_member.invitation i
  WHERE i.member = NEW.address;
  IF NOT FOUND THEN
    RAISE EXCEPTION '% has no first device: an invitation carries one', NEW.address
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER enrol AFTER UPDATE OF status ON member.member
  FOR EACH ROW WHEN (OLD.status = 'invited' AND NEW.status = 'active')
  EXECUTE FUNCTION key_member.enrol();

GRANT USAGE ON SCHEMA key_member TO cella_app, cella_rules;
GRANT SELECT, INSERT ON key_member.invitation TO cella_app;
GRANT SELECT ON key_member.invitation TO cella_rules;
