-- The owning circles whose records an actor's mandates for a power cover
-- on a day, by the same seats and mandates as `may`: every circle for a
-- mandate marking no scope, the seat's circle for `own`, the circle it
-- names for any other. A right is never read here: it opens no one
-- else's rows.
CREATE FUNCTION membership.covered(actor text, power text, day date) RETURNS text[]
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT ARRAY(
    SELECT DISTINCT c.id
    FROM circle.seat p
    JOIN circle.mandate m ON m.grantee = p.role
    JOIN membership.member mm ON mm.address = p.member
    JOIN circle.circle c ON circle.covers(m.scope, p.circle, c.id)
    WHERE p.member = covered.actor
      AND mm.status = 'active'
      AND m.power = covered.power
      AND (p.since IS NULL OR p.since <= covered.day)
      AND (p.until IS NULL OR p.until > covered.day)
      AND (m."from" IS NULL OR m."from" <= covered.day)
      AND (m.until IS NULL OR m.until > covered.day)
      AND (m.revoked IS NULL OR m.revoked > covered.day)
    ORDER BY c.id
  );
END;

-- The authority every read asks: whether a member holds a power on a day,
-- by their seats and the mandates on them (`may`), and the circles those
-- mandates cover (`covered`), so a feat's rows read by a power open to
-- whoever holds it, in the circles its scope covers.
INSERT INTO cella.authority (fn, covered, owner) VALUES
  ('membership.may(text, text, bigint, text, date)', 'membership.covered(text, text, date)', 'membership');
