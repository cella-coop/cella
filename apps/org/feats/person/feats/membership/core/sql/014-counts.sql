-- Whether a seat counts on a day. Any person may hold a seat, member or
-- not: the assembly's asks an active membership, as
-- membership says one is on the day (`membership.active`), not a copy of
-- its status; any other asks a person the co-op knows whom membership
-- has not suspended or let go by the day. So a worker who is no member
-- sits in their working circle, and a power asked of a past day reads
-- who sat then.
CREATE FUNCTION membership.counts(person text, circle text, day date) RETURNS boolean
LANGUAGE sql STABLE
RETURN CASE
  WHEN counts.circle = circle.assembly()
    THEN membership.active(counts.person, counts.day)
  ELSE person.known(counts.person, counts.day)
    AND (membership.active(counts.person, counts.day)
      OR NOT EXISTS (
        SELECT FROM membership.member m
        WHERE m.address = counts.person AND m.status IN ('suspended', 'exited')
      ))
END;

-- Whether a person holds a seat in a circle on a day, and it counts: what
-- the guards that know the circle an action concerns ask.
CREATE FUNCTION membership.sits_in(person text, circle text, day date) RETURNS boolean
LANGUAGE sql STABLE
RETURN EXISTS (SELECT FROM circle.seated(sits_in.circle, sits_in.day) s WHERE s = sits_in.person)
  AND membership.counts(sits_in.person, sits_in.circle, sits_in.day);

-- The mandates in force a person holds on a day by their seats, each
-- with the circle of the seat it is held by: on every seat that counts
-- and has begun and not ended, its role's and the participant role's,
-- which every seat holds beside its own, so a seat with no role still
-- holds the participant's, once for each circle the person sits in. It
-- is the one place the seats and the mandates are joined: `may` and
-- `covered` ask it, and a person's page lists it.
CREATE FUNCTION membership.holds(person text, day date) RETURNS TABLE (mandate bigint, circle text)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT DISTINCT m.id, p.circle
  FROM circle.seat p
  JOIN circle.mandate m ON m.grantee = p.role OR m.grantee = 'participant'
  WHERE p.member = holds.person
    AND membership.counts(p.member, p.circle, holds.day)
    AND (p.since IS NULL OR p.since <= holds.day)
    AND (p.until IS NULL OR p.until > holds.day)
    AND (m."from" IS NULL OR m."from" <= holds.day)
    AND (m.until IS NULL OR m.until > holds.day)
    AND (m.revoked IS NULL OR m.revoked > holds.day);
END;

-- A power is held, and a circle's channel kept, by a mandate the person
-- holds (`holds`) whose scope covers the record from its seat's circle:
-- the participant's are found on any seat, and the guard that knows the
-- circle a write concerns holds them to a seat there (`sits`).
CREATE OR REPLACE FUNCTION membership.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM membership.holds(may.actor, may.day) h
    JOIN circle.mandate m ON m.id = h.mandate
    WHERE m.power = may.power
      AND circle.covers(m.scope, h.circle, may.about)
      AND (m."limit" IS NULL OR may.cents IS NULL OR may.cents <= cella.cents(m."limit"))
  );
END;

-- The circles a power's mandates cover follow the same mandates.
CREATE OR REPLACE FUNCTION membership.covered(actor text, power text, day date) RETURNS text[]
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT ARRAY(
    SELECT DISTINCT c.id
    FROM membership.holds(covered.actor, covered.day) h
    JOIN circle.mandate m ON m.id = h.mandate
    JOIN circle.circle c ON circle.covers(m.scope, h.circle, c.id)
    WHERE m.power = covered.power
    ORDER BY c.id
  );
END;

CREATE OR REPLACE FUNCTION membership.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT membership.sits_in(cella.actor(), p.circle, cella.verdict_date())
      THEN cella.actor() || ' holds no seat in ' || coalesce(p.circle, 'no circle')
  END
  FROM (SELECT payload ->> 'circle' AS circle) p;
END;
