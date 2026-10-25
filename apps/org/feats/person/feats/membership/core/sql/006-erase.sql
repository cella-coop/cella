-- A membership holds no personal data of its own: the person's name and
-- contact details are the person's. Its address is the pseudonym every
-- entry names the member by.
COMMENT ON COLUMN membership.member.address IS 'not personal: the pseudonymous address every log entry names the member by';

-- membership:member:erase — the write erased the personal data of a member
-- who has left, every class: the cited decision asks it, which is the
-- decision-membership graft's rule.
CREATE FUNCTION membership.erases(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'no member ' || coalesce(p.member, 'is named')
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

INSERT INTO cella.rule (op, fn, owner) VALUES ('membership:member:erase', 'membership.erases(jsonb)', 'membership');
