-- Erasing the personal data of a member who has left, decided by the
-- assembly as an exit is: the motion asks it, and its close carries it
-- out.
SELECT motion.register_carries('erase', 'Erase a former member''s personal data', '[{"name": "member", "label": "Address", "type": "text"}]', 'membership-motion');

CREATE OR REPLACE VIEW membership_motion.action AS
SELECT m.motion, m.n, m.kind, m.args ->> 'member' AS member,
       CASE WHEN m.args ->> 'shares' ~ '^[0-9]{1,9}$' THEN (m.args ->> 'shares')::integer END AS shares
FROM motion.action m
WHERE m.kind IN ('admit', 'suspend', 'exit', 'erase');

-- motion:motion:propose — as before, and an erasure names a member
-- who has left.
CREATE OR REPLACE FUNCTION membership_motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN m.member IS NULL THEN m.motion || ' names no member to ' || m.kind
      WHEN mm.address IS NULL THEN 'no member ' || m.member
      WHEN m.kind = 'admit' AND mm.status <> 'invited' THEN m.member || ' is ' || mm.status || ', not invited'
      WHEN m.kind = 'admit' AND coalesce(m.shares, 0) <= 0 THEN 'an admission subscribes a whole number of shares'
      WHEN m.kind = 'suspend' AND mm.status <> 'active' THEN m.member || ' is ' || mm.status || ', not active'
      WHEN m.kind = 'exit' AND mm.status NOT IN ('active', 'suspended') THEN m.member || ' is ' || mm.status
      WHEN m.kind = 'erase' AND mm.status <> 'exited' THEN m.member || ' is ' || mm.status || ': only a member who has left is erased'
    END AS r
    FROM membership_motion.action m
    LEFT JOIN membership.member mm ON mm.address = m.member
    WHERE m.motion = payload ->> 'motion'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('membership:member:erase', 'membership_motion.ends(jsonb)', 'membership-motion');
SELECT motion.register_cite('membership:member:erase', 'membership-motion');
