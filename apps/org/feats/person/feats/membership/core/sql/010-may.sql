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

-- Why a member may not use a power over a record of the circle `about`
-- on a day, as a reason naming the mandate missing or exceeded and what
-- would fix it, with the values it read, or NULL where `may` holds. It
-- reads the seats and mandates `may` reads and says the first that fits:
-- a mandate that would allow it, to an active member alone; one in force
-- covering the record whose limit the amount exceeds, the widest; one in
-- force whose scope does not cover the record's circle; one on a seat
-- held that is revoked, expired or yet to apply; one in force on a
-- tenure ended; or none, with the roles that hold the power over the
-- record's circle within the amount and the circle that issued each
-- one's mandate. It names roles, circles and mandates, never a person,
-- so a reason the log keeps names no one. A budget is not checked, as
-- `may` checks none.
CREATE FUNCTION membership.why_not(actor text, power text, cents bigint, about text, day date) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  WITH held AS (
    SELECT m.id, m.grantee, m.issuer, m."limit", m.budget, m.per, m.scope, m."from", m.until, m.revoked,
      p.circle AS seated, p.until AS ended,
      (p.since IS NULL OR p.since <= why_not.day) AND (p.until IS NULL OR p.until > why_not.day) AS sitting,
      (m."from" IS NULL OR m."from" <= why_not.day) AND (m.until IS NULL OR m.until > why_not.day)
        AND (m.revoked IS NULL OR m.revoked > why_not.day) AS standing,
      circle.covers(m.scope, p.circle, why_not.about) AS covering,
      (m."limit" IS NULL OR why_not.cents IS NULL OR why_not.cents <= cella.cents(m."limit")) AS within
    FROM circle.seat p
    JOIN circle.mandate m ON m.grantee = p.role
    WHERE p.member = why_not.actor AND m.power = why_not.power
  ),
  holders AS (
    SELECT string_agg(DISTINCT h.said, ', ' ORDER BY h.said) AS said
    FROM (
      SELECT r.id || ' in ' || CASE r.circle WHEN '*' THEN why_not.about ELSE r.circle END
        || ' (mandate ' || m.id || ', issued by ' || m.issuer || ')' AS said
      FROM circle.mandate m
      JOIN circle.role r ON r.id = m.grantee
      WHERE m.power = why_not.power
        AND m."from" <= why_not.day AND (m.until IS NULL OR m.until > why_not.day)
        AND (m.revoked IS NULL OR m.revoked > why_not.day)
        AND circle.covers(m.scope, CASE r.circle WHEN '*' THEN why_not.about ELSE r.circle END, why_not.about)
        AND (m."limit" IS NULL OR why_not.cents IS NULL OR why_not.cents <= cella.cents(m."limit"))
    ) h
  ),
  wanted AS (
    SELECT why_not.power || coalesce(' up to ' || cella.amount(why_not.cents)::text || ' €', '') AS power,
      coalesce(why_not.about, 'the whole co-op') AS about,
      coalesce((SELECT mm.status FROM membership.member mm WHERE mm.address = why_not.actor), 'none') AS status
  )
  SELECT CASE
    WHEN membership.may(why_not.actor, why_not.power, why_not.cents, why_not.about, why_not.day) THEN NULL
    WHEN EXISTS (SELECT FROM held h WHERE h.sitting AND h.standing AND h.covering AND h.within) THEN (
      SELECT 'the actor holds no mandate for ' || w.power || ', their membership being ' || w.status
        || ': mandate ' || h.id || ' grants it to ' || h.grantee || ' in ' || h.seated
        || ' for an active member alone, and an active membership would allow it'
      FROM held h, wanted w
      WHERE h.sitting AND h.standing AND h.covering AND h.within
      ORDER BY h.id LIMIT 1)
    WHEN EXISTS (SELECT FROM held h WHERE h.sitting AND h.standing AND h.covering) THEN (
      SELECT 'the actor holds no mandate for ' || w.power
        || ': mandate ' || h.id || ' grants it to ' || h.grantee || ' in ' || h.seated
        || ' ' || circle.cap(h."limit", h.budget, h.per) || ', issued by ' || h.issuer
        || '; a motion of ' || h.issuer || ' raising its limit to ' || cella.amount(why_not.cents)::text || ' €'
        || coalesce(', or a tenure of a role holding it up to that, ' || o.said || ',', '') || ' would allow it'
      FROM held h, holders o, wanted w
      WHERE h.sitting AND h.standing AND h.covering
      ORDER BY cella.cents(h."limit") DESC, h.id LIMIT 1)
    WHEN EXISTS (SELECT FROM held h WHERE h.sitting AND h.standing) THEN (
      SELECT 'the actor holds ' || why_not.power || ' by no mandate covering ' || w.about || '''s records'
        || ': mandate ' || h.id || ' grants it to ' || h.grantee || ' in ' || h.seated
        || ' over ' || CASE h.scope WHEN 'own' THEN h.seated ELSE h.scope END || '''s records, issued by ' || h.issuer
        || '; ' || coalesce('a tenure of a role holding it there, ' || o.said || ', or ', '')
        || 'a motion of ' || h.issuer || ' granting it over ' || w.about || '''s records would allow it'
      FROM held h, holders o, wanted w
      WHERE h.sitting AND h.standing
      ORDER BY h.id LIMIT 1)
    WHEN EXISTS (SELECT FROM held h WHERE h.sitting AND h.covering) THEN (
      SELECT 'the actor holds no mandate for ' || w.power
        || ': mandate ' || h.id || ' grants it to ' || h.grantee || ' in ' || h.seated || CASE
          WHEN h.revoked <= why_not.day THEN ', revoked on ' || h.revoked
          WHEN h.until <= why_not.day THEN ', expired on ' || h.until
          ELSE ' from ' || h."from" || ', not yet'
        END || '; a motion of ' || h.issuer || ' granting it anew would allow it'
      FROM held h, wanted w
      WHERE h.sitting AND h.covering
      ORDER BY coalesce(h.revoked, h.until, h."from") DESC, h.id LIMIT 1)
    WHEN EXISTS (SELECT FROM held h WHERE h.standing AND h.covering AND h.ended <= why_not.day) THEN (
      SELECT 'the actor holds no mandate for ' || w.power
        || ': mandate ' || h.id || ' grants it to ' || h.grantee || ' in ' || h.seated
        || ', whose tenure ended on ' || h.ended || '; a tenure of ' || h.grantee || ' again would allow it'
      FROM held h, wanted w
      WHERE h.standing AND h.covering AND h.ended <= why_not.day
      ORDER BY h.ended DESC, h.id LIMIT 1)
    ELSE (
      SELECT 'the actor holds no mandate for ' || w.power || ' over ' || w.about || '''s records'
        || coalesce(': it is held by ' || o.said || ', and a tenure of one would allow it',
          ': no role holds it, and a motion of ' || coalesce(circle.assembly(), 'the assembly') || ' granting it would allow it')
      FROM holders o, wanted w)
  END;
END;

-- Every op with a power in cella.power — the actor holds it on the verdict
-- date over the record the write concerns, whose owning circle its payload
-- names (`circle`, the root's where it names none), within the mandate's
-- limit for the amount the payload names; refused, `why_not` says why.
CREATE FUNCTION membership.empowered(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.amount IS NOT NULL AND w.cents IS NULL THEN w.op || ' names its amount in ' || w.amount || ', which the payload lacks'
    ELSE membership.why_not(cella.actor(), w.power, w.cents, w.about, cella.verdict_date())
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
