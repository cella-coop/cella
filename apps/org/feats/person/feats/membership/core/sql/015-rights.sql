-- A right needs no seat, and is no mandate: the actor holds it where person's
-- core says they are one of the people it names on the day
-- (`person.holds`), every person, every member or every employee. A
-- right lets each act on what is their own, which the feat's guard
-- checks, and so opens no one else's rows: it is never the authority
-- reads ask (`may`), only what a write may use beside a seat's mandates.
-- The rights in force a person holds on a day are read in one place, as
-- the seats' mandates are by `holds`: `entitled` asks it, and a person's
-- page lists it, each right with its kind, power and limit. It runs as
-- its owner, so a person who is no member, and reads no row of
-- `circle.right`, reads the rights they hold: to the app's reader it
-- answers for themselves, or for anyone where they are a member
-- (`circle.inside`), and otherwise nothing; a write's transaction, where
-- `entitled` asks it, and a superuser's session read it whole.
CREATE FUNCTION membership.rights(person text, day date)
RETURNS TABLE (id bigint, "right" text, power text, "limit" cella.amount)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT m.id, m."right", m.power, m."limit"
  FROM circle.right m
  WHERE ((SELECT circle.whole()) OR rights.person = cella.reader() OR (SELECT circle.inside()))
    AND (m."from" IS NULL OR m."from" <= rights.day)
    AND (m.until IS NULL OR m.until > rights.day)
    AND (m.revoked IS NULL OR m.revoked > rights.day)
    AND person.holds(rights.person, m."right", rights.day);
END;
COMMENT ON FUNCTION membership.rights(text, date) IS 'audience: shared: the rights a person holds, which a non-member reads no row of, it keeps for that person, a member of the scope and a write';

CREATE FUNCTION membership.entitled(actor text, power text, cents bigint, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM membership.rights(entitled.actor, entitled.day) r
    WHERE r.power = entitled.power
      AND (r."limit" IS NULL OR entitled.cents IS NULL OR entitled.cents <= cella.cents(r."limit"))
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
