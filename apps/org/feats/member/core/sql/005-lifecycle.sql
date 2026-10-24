-- The days a membership moved: invited, suspended and exited, beside
-- `since`, the day it was admitted. A suspension lifted keeps its day
-- until the next.
ALTER TABLE member.member
  ADD COLUMN invited date,
  ADD COLUMN suspended date,
  ADD COLUMN exited date;

-- member:member:invite — the write invited a new member on the verdict
-- date, by an address no one holds.
CREATE FUNCTION member.invites(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'no member ' || coalesce(p.address, 'is named')
    WHEN m.status <> 'invited' OR m.invited IS DISTINCT FROM cella.verdict_date()
      THEN m.address || ' was not invited by this write'
  END
  FROM (SELECT payload ->> 'member' AS address) p
  LEFT JOIN member.member m ON m.address = p.address;
END;

-- member:member:suspend, member:member:exit — the write left the member
-- suspended, or exited, on the verdict date. That the cited decision asks
-- it is the decision-member graft's rule on the same ops.
CREATE FUNCTION member.ends(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'no member ' || coalesce(p.address, 'is named')
    WHEN split_part(cella.op(), ':', 3) = 'suspend'
      AND (m.status <> 'suspended' OR m.suspended IS DISTINCT FROM cella.verdict_date())
      THEN m.address || ' was not suspended by this write'
    WHEN split_part(cella.op(), ':', 3) = 'exit'
      AND (m.status <> 'exited' OR m.exited IS DISTINCT FROM cella.verdict_date())
      THEN m.address || ' did not exit by this write'
  END
  FROM (SELECT payload ->> 'member' AS address) p
  LEFT JOIN member.member m ON m.address = p.address;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('member:member:invite', 'member.invites(jsonb)', 'member'),
  ('member:member:suspend', 'member.ends(jsonb)', 'member'),
  ('member:member:exit', 'member.ends(jsonb)', 'member');
