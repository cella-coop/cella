-- An invitation is taken up by a one-time link: the invitee opens it, their
-- browser makes their first device and signs its own acceptance, and the
-- acceptance enrols the device. Each link is the SHA-256 of a secret the
-- inviter's browser drew, which only the link holds: the server keeps the
-- digest, never the secret. An invited member may hold several links,
-- since a link is a fact and two do no harm; the first taken up ends them
-- all.
CREATE TABLE membership.link (
  digest bytea PRIMARY KEY CHECK (length(digest) = 32),
  member text NOT NULL REFERENCES membership.member (address),
  made date NOT NULL
);

-- From here on an invitation's row is its acceptance: the first device it
-- enrolled, the label the invitee gave it and the day.
ALTER TABLE membership.invitation ADD COLUMN accepted date;

-- membership:member:invite — the link its payload names, if any, is the
-- member's, made by this write.
CREATE OR REPLACE FUNCTION membership.carries(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.link IS NOT NULL AND l.member IS DISTINCT FROM p.member THEN coalesce(p.member, 'no one') || '''s invitation carries no link its payload names'
    WHEN p.link IS NOT NULL AND l.made IS DISTINCT FROM cella.verdict_date() THEN 'the link was not made by this write'
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'link' AS link) p
  LEFT JOIN membership.link l ON encode(l.digest, 'hex') = p.link;
END;

-- membership:member:link — a new link for someone invited who has not
-- taken up their invitation, made by this write.
CREATE FUNCTION membership.links(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'no one invited is ' || coalesce(p.member, 'named')
    WHEN m.status <> 'invited' THEN m.address || ' is ' || m.status
    WHEN EXISTS (SELECT FROM membership.invitation i WHERE i.member = p.member) THEN m.address || ' has taken up their invitation'
    WHEN l.member IS DISTINCT FROM p.member OR l.made IS DISTINCT FROM cella.verdict_date() THEN 'the link was not made by this write'
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'link' AS link) p
  LEFT JOIN membership.member m ON m.address = p.member
  LEFT JOIN membership.link l ON encode(l.digest, 'hex') = p.link;
END;

-- membership:member:accept — the invitee took up their invitation by one
-- of its links, signed by the device this write enrolled as their first:
-- enrolled by no device, on the verdict date, the key the payload names.
CREATE FUNCTION membership.accepts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN cella.actor() IS DISTINCT FROM p.member THEN 'an invitation is taken up by whom it invites, not ' || cella.actor()
    WHEN m.status IS DISTINCT FROM 'invited' THEN coalesce(p.member, 'no one') || ' is not invited'
    WHEN NOT EXISTS (SELECT FROM membership.link l WHERE encode(l.digest, 'hex') = p.link AND l.member = p.member)
      THEN 'the link is not ' || p.member || '''s'
    WHEN i.accepted IS DISTINCT FROM cella.verdict_date() OR encode(i.key, 'hex') IS DISTINCT FROM p.key
      THEN p.member || '''s invitation was not taken up by this write'
    WHEN encode(cella.device(), 'hex') IS DISTINCT FROM p.key THEN 'an invitation is taken up by the device it enrols'
    WHEN NOT EXISTS (
      SELECT FROM person.device d
      WHERE d.key = i.key AND d.address = p.member AND d.enrolled_by IS NULL AND d.enrolled = cella.verdict_date()
    ) THEN 'device ' || left(p.key, 16) || ' was not enrolled by this write'
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'link' AS link, payload ->> 'key' AS key) p
  LEFT JOIN membership.member m ON m.address = p.member
  LEFT JOIN membership.invitation i ON i.member = p.member;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('membership:member:link', 'membership.links(jsonb)', 'membership'),
  ('membership:member:accept', 'membership.accepts(jsonb)', 'membership');

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('membership:member:link', 'invite-member', NULL, 'membership');

-- An admission no longer enrols a device: the acceptance did. It is
-- refused for someone who holds no current device, invited or a worker,
-- so no member is admitted unable to sign.
DROP TRIGGER enrol ON membership.member;
DROP FUNCTION membership.enrol();

CREATE FUNCTION membership.signs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM person.device d WHERE d.address = NEW.address AND d.revoked IS NULL) THEN
    RAISE EXCEPTION '% holds no device to sign with: they take up their invitation first', NEW.address
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER signs AFTER UPDATE OF status ON membership.member
  FOR EACH ROW WHEN (OLD.status = 'invited' AND NEW.status = 'active')
  EXECUTE FUNCTION membership.signs();

GRANT SELECT, INSERT ON membership.link TO cella_app;
GRANT SELECT ON membership.link TO cella_guards;
