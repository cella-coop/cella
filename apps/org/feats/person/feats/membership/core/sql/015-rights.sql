-- A right needs no seat, and is no mandate: the actor holds it where person's
-- core says they are one of the people it names on the day
-- (`person.holds`), every person, every member or every employee. A
-- right lets each act on what is their own, which the feat's guard
-- checks, and so opens no one else's rows: it is never the authority
-- reads ask (`may`), only what a write may use beside a seat's mandates.
CREATE FUNCTION membership.entitled(actor text, power text, cents bigint, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle.right m
    WHERE m.power = entitled.power
      AND (m."from" IS NULL OR m."from" <= entitled.day)
      AND (m.until IS NULL OR m.until > entitled.day)
      AND (m.revoked IS NULL OR m.revoked > entitled.day)
      AND (m."limit" IS NULL OR entitled.cents IS NULL OR entitled.cents <= cella.cents(m."limit"))
      AND person.holds(entitled.actor, m."right", entitled.day)
  );
END;

-- Every op with a power in cella.power — the actor holds it on the verdict
-- date, by a seat's mandate whose scope covers the owning circle of the
-- record the write concerns, or by a right, within the mandate's limit
-- for the amount the payload names. The payload names the record's
-- circle, `circle`, as its handler reads it from the record or writes it
-- there, and one naming none concerns the root's, the assembly's. This is
-- the one guard that reads a permission's scope: no slice checks it again.
-- A right reaches the whole co-op. Refused, `why_not` says by what
-- mandate, missing or exceeded, and what would fix it.
CREATE OR REPLACE FUNCTION membership.empowered(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.amount IS NOT NULL AND w.cents IS NULL THEN w.op || ' names its amount in ' || w.amount || ', which the payload lacks'
    WHEN membership.may(cella.actor(), w.power, w.cents, w.about, cella.verdict_date())
      OR membership.entitled(cella.actor(), w.power, w.cents, cella.verdict_date()) THEN NULL
    ELSE membership.why_not(cella.actor(), w.power, w.cents, w.about, cella.verdict_date())
  END
  FROM (
    SELECT p.op, p.power, p.amount, (payload ->> p.amount)::bigint AS cents,
      coalesce(payload ->> 'circle', circle.assembly()) AS about
    FROM cella.power p
    WHERE p.op = cella.action()
  ) w;
END;
