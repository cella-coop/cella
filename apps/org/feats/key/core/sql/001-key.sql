CREATE SCHEMA key;

-- A device, by its Ed25519 public key, under one address for good. A first
-- device has no `enrolled_by`; every later one names the device that signed
-- its enrolment. A revoked device stays, so what it signed before still
-- reads back.
CREATE TABLE key.device (
  key bytea PRIMARY KEY CHECK (length(key) = 32),
  address text NOT NULL,
  label text NOT NULL,
  enrolled date NOT NULL,
  enrolled_by bytea REFERENCES key.device,
  revoked date,
  CHECK (revoked IS NULL OR revoked >= enrolled)
);

CREATE INDEX ON key.device (address);

-- A device's address, key and enrolment never change, and a revocation
-- stands.
CREATE FUNCTION key.stays() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.key, NEW.address, NEW.enrolled, NEW.enrolled_by) IS DISTINCT FROM (OLD.key, OLD.address, OLD.enrolled, OLD.enrolled_by)
    OR (OLD.revoked IS NOT NULL AND NEW.revoked IS DISTINCT FROM OLD.revoked) THEN
    RAISE EXCEPTION 'device % of % keeps its key, address and enrolment, and stays revoked', OLD.label, OLD.address
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays BEFORE UPDATE ON key.device
  FOR EACH ROW EXECUTE FUNCTION key.stays();

-- The keyring: whether a device is a current key of the actor. The notary
-- calls it for every write, before any rule, under the log's head lock, so
-- a revocation that settled first is seen.
CREATE FUNCTION key.verifies(actor text, device bytea) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.key IS NULL THEN 'device ' || left(encode(x.device, 'hex'), 16) || ' is not enrolled'
    WHEN d.address <> x.actor THEN d.address || '''s ' || d.label || ' signs for ' || d.address || ', not for ' || x.actor
    WHEN d.revoked IS NOT NULL THEN d.address || '''s ' || d.label || ' was revoked on ' || to_char(d.revoked, 'YYYY-MM-DD')
  END
  FROM (SELECT verifies.actor AS actor, verifies.device AS device) x
  LEFT JOIN key.device d ON d.key = x.device;
END;

INSERT INTO cella.keyring (fn, owner) VALUES ('key.verifies(text, bytea)', 'key');

-- key:key:enrol — the member enrols a device for their own address, signed
-- by one of their current devices (the keyring has checked the signer),
-- and the device was enrolled by this write.
CREATE FUNCTION key.enrols(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.address IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not enrol a device for ' || coalesce(p.address, 'no one')
    WHEN d.key IS NULL THEN 'no device ' || left(coalesce(p.key, 'named'), 16) || ' is enrolled'
    WHEN d.address <> p.address OR d.enrolled_by IS DISTINCT FROM cella.device() OR d.enrolled <> cella.verdict_date()
      THEN 'device ' || left(p.key, 16) || ' was not enrolled by this write'
  END
  FROM (SELECT payload ->> 'address' AS address, payload ->> 'key' AS key) p
  LEFT JOIN key.device d ON encode(d.key, 'hex') = p.key;
END;

-- key:key:revoke — the member revokes one of their own devices, from
-- another, and the device was revoked by this write. Revoking another
-- member's device needs `revoke-key`, which is not built.
CREATE FUNCTION key.revokes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.key IS NULL THEN 'no device ' || left(coalesce(p.key, 'named'), 16) || ' is enrolled'
    WHEN d.address <> cella.actor() THEN cella.actor() || ' may not revoke ' || d.address || '''s ' || d.label
    WHEN d.revoked IS DISTINCT FROM cella.verdict_date() THEN d.address || '''s ' || d.label || ' was not revoked by this write'
  END
  FROM (SELECT payload ->> 'key' AS key) p
  LEFT JOIN key.device d ON encode(d.key, 'hex') = p.key;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('key:key:enrol', 'key.enrols(jsonb)', 'key'),
  ('key:key:revoke', 'key.revokes(jsonb)', 'key');

GRANT USAGE ON SCHEMA key TO cella_app, cella_rules;
GRANT SELECT, INSERT, UPDATE ON key.device TO cella_app;
GRANT SELECT ON key.device TO cella_rules;
