-- A right needs no seat, and is no mandate: the actor holds it where person's
-- core says they are one of the people it names on the day
-- (`person.holds`), every person, every member or every employee. A
-- right lets each act on what is their own, which the feat's guard
-- checks, and so opens no one else's rows: it is never the authority
-- reads ask (`may`), only what a write may use beside a seat's mandates.
CREATE FUNCTION circle_membership.entitled(actor text, power text, cents bigint, day date) RETURNS boolean
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
-- date, by a seat's mandate or by a right, within the mandate's limit for
-- the amount the payload names.
CREATE OR REPLACE FUNCTION circle_membership.empowered(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.amount IS NOT NULL AND w.cents IS NULL THEN w.op || ' names its amount in ' || w.amount || ', which the payload lacks'
    WHEN NOT circle_membership.may(cella.actor(), w.power, w.cents, cella.verdict_date())
      AND NOT circle_membership.entitled(cella.actor(), w.power, w.cents, cella.verdict_date()) THEN
      cella.actor() || ' holds no mandate for ' || w.power
        || coalesce(' up to ' || cella.amount(w.cents)::text || ' €', '')
  END
  FROM (
    SELECT p.op, p.power, p.amount, (payload ->> p.amount)::bigint AS cents
    FROM cella.power p
    WHERE p.op = cella.action()
  ) w;
END;
