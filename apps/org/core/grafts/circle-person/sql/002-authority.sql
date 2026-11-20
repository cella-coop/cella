-- Who may act: whether a seat counts on a day, the mandates a person
-- holds by their seats and the rights they hold as a person, the
-- authority every read asks and the guard on every op with a power. It
-- reads the seats and the mandates, the circles', and the people and the
-- rights they hold, the people's, so it is this graft's, in core: no feat
-- outside core holds the authority, and removing one changes no other
-- slice's authorization.

GRANT USAGE ON SCHEMA circle_person TO cella_app, cella_guards;

-- What bars a seat, as each kind of person says it of its people: `fn`,
-- `(person, circle, day) → text`, why the seat does not count on the
-- day, naming no person, or null where it bars none. A feat's migration
-- registers it by `register_standing`, and never inserts the row itself.
CREATE TABLE circle_person.standing (
  fn regprocedure PRIMARY KEY,
  owner text NOT NULL
);

COMMENT ON TABLE circle_person.standing IS 'registry: what bars a seat, as each kind of person registers it';

GRANT SELECT ON circle_person.standing TO cella_app, cella_guards;

CREATE FUNCTION circle_person.register_standing(fn regprocedure, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO circle_person.standing (fn, owner) VALUES (register_standing.fn, register_standing.owner);
END;

REVOKE EXECUTE ON FUNCTION circle_person.register_standing(regprocedure, text) FROM PUBLIC;

-- Why a seat in a circle does not count on a day, or null where it
-- counts: the person is no one the coop knows, or the first reason a
-- registered standing gives, by its owner's name. A scope where no kind
-- of person registers one bars no seat of a person it knows.
CREATE FUNCTION circle_person.unseated(person text, circle text, day date) RETURNS text
LANGUAGE plpgsql STABLE AS $$
DECLARE
  call text;
  why text;
BEGIN
  IF person IS NULL OR NOT person.known(person, day) THEN
    RETURN 'no person the coop knows';
  END IF;
  FOR call IN
    SELECT format('SELECT %I.%I($1::%s, $2::%s, $3::%s)', n.nspname, p.proname,
             p.proargtypes[0]::regtype, p.proargtypes[1]::regtype, p.proargtypes[2]::regtype)
    FROM circle_person.standing s
    JOIN pg_catalog.pg_proc p ON p.oid = s.fn
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    ORDER BY s.owner, s.fn::text
  LOOP
    EXECUTE call INTO why USING unseated.person, unseated.circle, unseated.day;
    IF why IS NOT NULL THEN
      RETURN why;
    END IF;
  END LOOP;
  RETURN NULL;
END
$$;

-- Whether a seat counts on a day: nothing bars it. Any person may hold a
-- seat, member or not, so a worker who is no member sits in their
-- working circle, and a power asked of a past day reads who sat then.
CREATE FUNCTION circle_person.counts(person text, circle text, day date) RETURNS boolean
LANGUAGE sql STABLE
RETURN circle_person.unseated(counts.person, counts.circle, counts.day) IS NULL;

-- Whether a person holds a seat in a circle on a day, and it counts: what
-- the guards that know the circle an action concerns ask.
CREATE FUNCTION circle_person.sits_in(person text, circle text, day date) RETURNS boolean
LANGUAGE sql STABLE
RETURN EXISTS (SELECT FROM circle.seated(sits_in.circle, sits_in.day) s WHERE s = sits_in.person)
  AND circle_person.counts(sits_in.person, sits_in.circle, sits_in.day);

-- The mandates in force a person holds on a day by their seats, each
-- with the circle of the seat it is held by: on every seat that counts
-- and has begun and not ended, its role's and the participant role's,
-- which every seat holds beside its own, so a seat with no role still
-- holds the participant's, once for each circle the person sits in. It
-- is the one place the seats and the mandates are joined: `may` and
-- `covered` ask it, and a person's page lists it.
CREATE FUNCTION circle_person.holds(person text, day date) RETURNS TABLE (mandate bigint, circle text)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT DISTINCT m.id, p.circle
  FROM circle.seat p
  JOIN circle.mandate m ON m.grantee = p.role OR m.grantee = 'participant'
  WHERE p.member = holds.person
    AND circle_person.counts(p.member, p.circle, holds.day)
    AND (p.since IS NULL OR p.since <= holds.day)
    AND (p.until IS NULL OR p.until > holds.day)
    AND (m."from" IS NULL OR m."from" <= holds.day)
    AND (m.until IS NULL OR m.until > holds.day)
    AND (m.revoked IS NULL OR m.revoked > holds.day);
END;

-- Whether a person may use a power over a record of the circle `about`
-- on a day: a mandate they hold (`holds`) grants it, whose scope covers
-- the record's owning circle from its seat's circle (`circle.covers`),
-- within its limit for `cents` when the write carries an amount.
-- Ownership grants nothing by itself, and a seat in the circle nothing
-- without a mandate; `about` null asks of no record. The participant's
-- are found on any seat, and the guard that knows the circle a write
-- concerns holds them to a seat there (`motion.sits`,
-- `meeting_membership.sits`). A revoked mandate grants nothing from the
-- day it was revoked. A mandate's budget, a total over a period, is not
-- checked: it needs spend tracking that is not built.
CREATE FUNCTION circle_person.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle_person.holds(may.actor, may.day) h
    JOIN circle.mandate m ON m.id = h.mandate
    WHERE m.power = may.power
      AND circle.covers(m.scope, h.circle, may.about)
      AND (m."limit" IS NULL OR may.cents IS NULL OR may.cents <= cella.cents(m."limit"))
  );
END;

-- The owning circles whose records an actor's mandates for a power cover
-- on a day, by the same mandates as `may`: every circle for a mandate
-- marking no scope, the seat's circle for `own`, the circle it names for
-- any other. A right is never read here: it opens no one else's rows.
CREATE FUNCTION circle_person.covered(actor text, power text, day date) RETURNS text[]
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT ARRAY(
    SELECT DISTINCT c.id
    FROM circle_person.holds(covered.actor, covered.day) h
    JOIN circle.mandate m ON m.id = h.mandate
    JOIN circle.circle c ON circle.covers(m.scope, h.circle, c.id)
    WHERE m.power = covered.power
    ORDER BY c.id
  );
END;

-- The authority every read asks: whether a person holds a power on a
-- day (`may`), and the circles those mandates cover (`covered`), so a
-- feat's rows read by a power open to whoever holds it, in the circles
-- its scope covers.
INSERT INTO cella.authority (fn, covered, owner) VALUES
  ('circle_person.may(text, text, bigint, text, date)', 'circle_person.covered(text, text, date)', 'circle-person');

-- A right needs no seat, and is no mandate: the actor holds it where
-- core's person says they are one of the people it names on the day
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
CREATE FUNCTION circle_person.rights(person text, day date)
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
COMMENT ON FUNCTION circle_person.rights(text, date) IS 'audience: shared: the rights a person holds, which a non-member reads no row of, it keeps for that person, a member of the scope and a write';

CREATE FUNCTION circle_person.entitled(actor text, power text, cents bigint, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle_person.rights(entitled.actor, entitled.day) r
    WHERE r.power = entitled.power
      AND (r."limit" IS NULL OR entitled.cents IS NULL OR entitled.cents <= cella.cents(r."limit"))
  );
END;

-- Why a person may not use a power over a record of the circle `about`
-- on a day, as a reason naming the mandate missing or exceeded and what
-- would fix it, with the values it read, or NULL where `may` holds. It
-- reads the seats and mandates `may` reads and says the first that fits:
-- a mandate that would allow it, on a seat that does not count, and why
-- (`unseated`); one in force covering the record whose limit the amount
-- exceeds, the widest; one in force whose scope does not cover the
-- record's circle; one on a seat held that is revoked, expired or yet to
-- apply; one in force on a tenure ended; or none, with the roles that
-- hold the power over the record's circle within the amount and the
-- circle that issued each one's mandate. It names roles, circles and
-- mandates, never a person, so a reason the log keeps names no one. A
-- budget is not checked, as `may` checks none.
CREATE FUNCTION circle_person.why_not(actor text, power text, cents bigint, about text, day date) RETURNS text
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
      coalesce(why_not.about, 'the whole coop') AS about
  )
  SELECT CASE
    WHEN circle_person.may(why_not.actor, why_not.power, why_not.cents, why_not.about, why_not.day) THEN NULL
    WHEN EXISTS (SELECT FROM held h WHERE h.sitting AND h.standing AND h.covering AND h.within) THEN (
      SELECT 'the actor holds no mandate for ' || w.power
        || ': mandate ' || h.id || ' grants it to ' || h.grantee || ' in ' || h.seated
        || ', on a seat that does not count there: ' || coalesce(circle_person.unseated(why_not.actor, h.seated, why_not.day), 'none')
        || '; a seat that counts would allow it'
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

-- Why a person may not use a power over a record of the circle `about`
-- on a day, for an amount: NULL where a seat's mandate (`may`) or a right
-- (`entitled`) grants it, else the reason `why_not` gives. The guard asks
-- it of a write as it is made (`empowered`), and a page of the writes it
-- offers before they are made (`judged`), so both judge by this one
-- function.
CREATE FUNCTION circle_person.refused(actor text, power text, cents bigint, about text, day date) RETURNS text
LANGUAGE sql STABLE
RETURN CASE
  WHEN circle_person.may(refused.actor, refused.power, refused.cents, refused.about, refused.day)
    OR circle_person.entitled(refused.actor, refused.power, refused.cents, refused.day) THEN NULL
  ELSE circle_person.why_not(refused.actor, refused.power, refused.cents, refused.about, refused.day)
END;

-- Every op with a power in cella.power — the actor holds it on the verdict
-- date, by a seat's mandate whose scope covers the owning circle of the
-- record the write concerns, or by a right, within the mandate's limit
-- for the amount the payload names. The payload names the record's
-- circle, `circle`, as its handler reads it from the record or writes it
-- there, and one naming none concerns the root's, the assembly's. This is
-- the one guard that reads a permission's scope: no slice checks it again.
-- A right reaches the whole coop. Refused, `why_not` says by what
-- mandate, missing or exceeded, and what would fix it.
CREATE FUNCTION circle_person.empowered(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.amount IS NOT NULL AND w.cents IS NULL THEN w.op || ' names its amount in ' || w.amount || ', which the payload lacks'
    ELSE circle_person.refused(cella.actor(), w.power, w.cents, w.about, cella.verdict_date())
  END
  FROM (
    SELECT p.op, p.power, p.amount, (payload ->> p.amount)::bigint AS cents,
      coalesce(payload ->> 'circle', circle.assembly()) AS about
    FROM cella.power p
    WHERE p.op = cella.action()
  ) w;
END;

-- Why the reader may not make a write over a record of the circle
-- `about`, asked before they make it: what `empowered` would answer at a
-- verdict on the verdict date, by `refused`, with no amount, since what an
-- amount would exceed is judged once the amount is given; NULL where it
-- would let it, or where no such guard attaches to the op, as to a write
-- with no power or a collective mandate's. `about` null asks of no
-- record, as `may` does, so a record naming no circle is judged by whether
-- the reader holds the power at all. It runs as its owner, so it reads the
-- seats, the mandates and what bars a seat whole, as the guard reads them
-- as the guards role, and it judges the reader alone (`cella.reader()`):
-- a scalar, it says only what making the write would say to them.
CREATE FUNCTION circle_person.judged(op text, about text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT circle_person.refused(cella.reader(), p.power, NULL, judged.about, cella.verdict_date())
  FROM cella.power p
  WHERE p.op = judged.op
    AND cella.reader() IS NOT NULL
    AND EXISTS (SELECT FROM cella.guard g WHERE g.op = p.op AND g.fn = 'circle_person.empowered(jsonb)'::regprocedure);
END;

REVOKE EXECUTE ON FUNCTION circle_person.judged(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION circle_person.judged(text, text) TO cella_app;

-- The guard attaches to every op with a power: those core's feats
-- registered before this graft migrated, and every one registered after.
INSERT INTO cella.guard (op, fn, owner)
SELECT p.op, 'circle_person.empowered(jsonb)'::regprocedure, 'circle-person' FROM cella.power p;

CREATE FUNCTION circle_person.attach() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO cella.guard (op, fn, owner)
  VALUES (NEW.op, 'circle_person.empowered(jsonb)', 'circle-person');
  RETURN NULL;
END
$$;

CREATE TRIGGER attach AFTER INSERT ON cella.power
  FOR EACH ROW EXECUTE FUNCTION circle_person.attach();
