-- A membership holds no personal data of its own: the person's name and
-- contact details are the person's. Its address is the pseudonym every
-- entry names the member by.
COMMENT ON COLUMN membership.member.address IS 'not personal: the pseudonymous address every log entry names the member by';

-- membership:member:erase — one who has left erases their own personal
-- data, by their right, every class: the member is the actor, they have
-- left, and the write erased it all, at once or restricted. No one erases
-- another, and no motion decides it.
CREATE FUNCTION membership.erases(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.member IS DISTINCT FROM cella.actor()
      THEN cella.actor() || ' may not erase ' || coalesce(p.member, 'no one') || '''s personal data: only their own'
    WHEN m.address IS NULL THEN 'no member ' || p.member
    WHEN m.status <> 'exited' THEN m.address || ' is ' || m.status || ': only a member who has left is erased'
    WHEN p.subject IS DISTINCT FROM m.address
      OR coalesce(jsonb_array_length(p.erased), 0) + coalesce(jsonb_array_length(p.restricted), 0)
        <> (SELECT count(*) FROM cella.retention)
      THEN 'the erasure is not of all of ' || m.address || '''s personal data'
  END
  FROM (
    SELECT payload ->> 'member' AS member,
           payload -> 'erasure' -> '$erasure' ->> 'subject' AS subject,
           payload -> 'erasure' -> '$erasure' -> 'erased' AS erased,
           payload -> 'erasure' -> '$erasure' -> 'restricted' AS restricted
  ) p
  LEFT JOIN membership.member m ON m.address = p.member;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('membership:member:erase', 'membership.erases(jsonb)', 'membership');
