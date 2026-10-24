-- A member's optional contact details, beside their name.
ALTER TABLE member.member
  ADD COLUMN email text,
  ADD COLUMN phone text;

-- What of a member is personal data, by class: their name, kept while
-- they belong and erased by decision once they have left; their contact
-- details, which they may erase themselves. Their address is the
-- pseudonym every entry names them by.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('member', 'member', 'name', 'member-profile', 'address', 'member'),
  ('member', 'member', 'email', 'contact', 'address', 'member'),
  ('member', 'member', 'phone', 'contact', 'address', 'member');

COMMENT ON COLUMN member.member.address IS 'not personal: the pseudonymous address every log entry names the member by';

GRANT UPDATE (email, phone) ON member.member TO cella_app;

-- member:member:erase — the write erased the personal data of a member
-- who has left, every class: the cited decision asks it, which is the
-- decision-member graft's rule.
CREATE FUNCTION member.erases(payload jsonb) RETURNS text
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
  LEFT JOIN member.member m ON m.address = p.member;
END;

-- member:member:forget — a member erases their own contact details, and
-- no one else's, and nothing more.
CREATE FUNCTION member.forgets(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.subject IS NULL THEN 'the write erases nothing'
    WHEN p.subject IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not erase ' || p.subject || '''s contact details'
    WHEN p.erased IS DISTINCT FROM '["contact"]'::jsonb OR p.restricted IS DISTINCT FROM '[]'::jsonb
      THEN 'a member erases their contact details alone'
  END
  FROM (
    SELECT payload -> 'erasure' -> '$erasure' ->> 'subject' AS subject,
           payload -> 'erasure' -> '$erasure' -> 'erased' AS erased,
           payload -> 'erasure' -> '$erasure' -> 'restricted' AS restricted
  ) p;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('member:member:erase', 'member.erases(jsonb)', 'member'),
  ('member:member:forget', 'member.forgets(jsonb)', 'member');
