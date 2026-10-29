-- Whether a person held an active membership on a day: admitted on or
-- before it, and not yet suspended nor gone. What the grafts that ask
-- "is this one an active member" read, rather than the status. The
-- record keeps one day per move, so a day inside a suspension since
-- lifted reads as active.
CREATE FUNCTION membership.active(person text, day date) RETURNS boolean
LANGUAGE sql STABLE
RETURN EXISTS (
  SELECT FROM membership.member m
  WHERE m.address = active.person
    AND (m.since IS NULL OR m.since <= active.day)
    AND CASE m.status
      WHEN 'active' THEN true
      WHEN 'suspended' THEN m.suspended > active.day
      WHEN 'exited' THEN m.exited > active.day AND (m.suspended IS NULL OR m.suspended > active.day)
      ELSE false
    END
);
