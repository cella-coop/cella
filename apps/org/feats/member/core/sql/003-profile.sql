-- member:member:profile — a member edits their own profile, and no one
-- else's.
CREATE FUNCTION member.own_profile(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'no member ' || coalesce(p.address, 'is named')
    WHEN m.address <> cella.actor() THEN cella.actor() || ' may not edit ' || m.address || '''s profile'
  END
  FROM (SELECT payload ->> 'member' AS address) p
  LEFT JOIN member.member m ON m.address = p.address;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('member:member:profile', 'member.own_profile(jsonb)', 'member');
