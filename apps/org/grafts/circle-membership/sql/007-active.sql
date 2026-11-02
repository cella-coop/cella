-- A power is held, and a circle's channel kept, by an active member as
-- membership says one is on the day (`membership.active`), not by a copy
-- of its status: so a power asked of a past day reads who was active then.
CREATE OR REPLACE FUNCTION circle_membership.may(actor text, power text, cents bigint, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle_membership.seat p
    JOIN circle.mandate m ON m.role = p.role
    WHERE p.member = may.actor
      AND membership.active(p.member, may.day)
      AND m.power = may.power
      AND (p.since IS NULL OR p.since <= may.day)
      AND (p.until IS NULL OR p.until > may.day)
      AND (m."from" IS NULL OR m."from" <= may.day)
      AND (m.until IS NULL OR m.until > may.day)
      AND (m.revoked IS NULL OR m.revoked > may.day)
      AND (m."limit" IS NULL OR may.cents IS NULL OR may.cents <= cella.cents(m."limit"))
  );
END;

CREATE OR REPLACE FUNCTION circle_membership.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (SELECT FROM circle_membership.seated(p.circle, cella.verdict_date()) s WHERE s = cella.actor())
      OR NOT membership.active(cella.actor(), cella.verdict_date())
      THEN cella.actor() || ' holds no seat in ' || coalesce(p.circle, 'no circle')
  END
  FROM (SELECT payload ->> 'circle' AS circle) p;
END;
