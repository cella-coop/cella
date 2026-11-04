-- Whether a member may use a power over a record of the circle `about` on
-- a day: they are active and hold a seat whose role has a mandate in
-- force granting it, whose scope covers the record's owning circle
-- (`circle.covers`), within its limit for `cents` when the write carries
-- an amount. Ownership grants nothing by itself, and a seat in the circle
-- nothing without a mandate; `about` null asks of no record, as reading
-- does until it follows the mandates. A revoked mandate grants nothing
-- from the day it was revoked, its policy's end: a revocation on the
-- verdict date counts from its receipt. A mandate's budget, a total over
-- a period, is not checked: it needs spend tracking that is not built.
CREATE FUNCTION membership.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle.seat p
    JOIN circle.mandate m ON m.grantee = p.role
    JOIN membership.member mm ON mm.address = p.member
    WHERE p.member = may.actor
      AND mm.status = 'active'
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

-- Every op with a power in cella.power — the actor holds it on the verdict
-- date over the record the write concerns, whose owning circle its payload
-- names (`circle`, the root's where it names none), within the mandate's
-- limit for the amount the payload names.
CREATE FUNCTION membership.empowered(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.amount IS NOT NULL AND w.cents IS NULL THEN w.op || ' names its amount in ' || w.amount || ', which the payload lacks'
    WHEN NOT membership.may(cella.actor(), w.power, w.cents, w.about, cella.verdict_date()) THEN
      cella.actor() || ' holds no mandate for ' || w.power
        || coalesce(' up to ' || cella.amount(w.cents)::text || ' €', '')
  END
  FROM (
    SELECT p.op, p.power, p.amount, (payload ->> p.amount)::bigint AS cents,
      coalesce(payload ->> 'circle', circle.assembly()) AS about
    FROM cella.power p
    WHERE p.op = cella.action()
  ) w;
END;

-- The guard attaches to every op with a power: those the feats registered
-- before this feat migrated, and any registered after.
INSERT INTO cella.guard (op, fn, owner)
SELECT p.op, 'membership.empowered(jsonb)'::regprocedure, 'membership' FROM cella.power p;

CREATE FUNCTION membership.attach() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO cella.guard (op, fn, owner)
  VALUES (NEW.op, 'membership.empowered(jsonb)', 'membership');
  RETURN NULL;
END
$$;

CREATE TRIGGER attach AFTER INSERT ON cella.power
  FOR EACH ROW EXECUTE FUNCTION membership.attach();
