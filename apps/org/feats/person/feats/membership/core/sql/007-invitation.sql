-- An invitation's first device: the public key the invitee's device made,
-- and the label they gave it, carried from the invitation to the admission
-- that enrols it among the person's devices. The label is the invitee's
-- own wording and stays out of the log.
CREATE TABLE membership.invitation (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  member text PRIMARY KEY,
  key bytea NOT NULL UNIQUE CHECK (length(key) = 32),
  label text NOT NULL CHECK (label <> '')
);

-- membership:member:invite — the invitation carries a first device: the key
-- its payload names, which no device holds yet.
CREATE FUNCTION membership.carries(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN i.member IS NULL THEN coalesce(p.member, 'no one') || ' is invited with no first device'
    WHEN encode(i.key, 'hex') IS DISTINCT FROM p.key THEN p.member || '''s invitation carries another key than its payload names'
    WHEN EXISTS (SELECT FROM person.device d WHERE d.key = i.key)
      THEN 'device ' || left(p.key, 16) || ' is enrolled already'
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'key' AS key) p
  LEFT JOIN membership.invitation i ON i.member = p.member;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('membership:member:invite', 'membership.carries(jsonb)', 'membership');

-- Admission enrols the invitation's device, in the admitting write's own
-- transaction: when a member moves from invited to active, their first
-- device is enrolled on the verdict date, enrolled by no device, as the
-- invitation carried it. An admission whose invitation carries no device,
-- of someone who holds no current one either, is refused with it, so no
-- member is admitted unable to sign; a worker invited to join signs with
-- the device their hire enrolled.
CREATE FUNCTION membership.enrol() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO person.device (key, address, label, enrolled)
  SELECT i.key, i.member, i.label, cella.verdict_date()
  FROM membership.invitation i
  WHERE i.member = NEW.address;
  IF NOT FOUND AND NOT EXISTS (SELECT FROM person.device d WHERE d.address = NEW.address AND d.revoked IS NULL) THEN
    RAISE EXCEPTION '% has no first device: an invitation carries one', NEW.address
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER enrol AFTER UPDATE OF status ON membership.member
  FOR EACH ROW WHEN (OLD.status = 'invited' AND NEW.status = 'active')
  EXECUTE FUNCTION membership.enrol();

GRANT SELECT, INSERT ON membership.invitation TO cella_app;
GRANT SELECT ON membership.invitation TO cella_guards;
