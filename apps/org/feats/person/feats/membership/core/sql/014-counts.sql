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

-- A power is held, and a circle's channel kept, by a seat that counts.
-- Every seat holds its circle's participant role beside its own, so the
-- participant's mandates are found on any seat; the guard that knows the
-- circle a write concerns holds them to a seat there (`sits`).
CREATE OR REPLACE FUNCTION membership.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle.seat p
    JOIN circle.mandate m ON m.grantee = p.role OR m.grantee = 'participant'
    WHERE p.member = may.actor
      AND membership.counts(p.member, p.circle, may.day)
      AND m.power = may.power
      AND circle.covers(m.scope, p.circle, may.about)
      AND (p.since IS NULL OR p.since <= may.day)
      AND (p.until IS NULL OR p.until > may.day)
      AND (m."from" IS NULL OR m."from" <= may.day)
      AND (m.until IS NULL OR m.until > may.day)
      AND (m.revoked IS NULL OR m.revoked > may.day)
      AND (m."limit" IS NULL OR may.cents IS NULL OR may.cents <= cella.cents(m."limit"))
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
