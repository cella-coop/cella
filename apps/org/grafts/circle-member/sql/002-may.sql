-- Whether a member may use a power on a day: they are active and hold a
-- seat whose role has a mandate in force granting it, within its limit for
-- `cents` when the write carries an amount. A revoked mandate grants
-- nothing from its revocation's receipt on, so any revocation counts. A
-- mandate's budget, a total over a period, is not checked: it needs spend
-- tracking that is not built.
CREATE FUNCTION circle_member.may(actor text, power text, cents bigint, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle_member.position p
    JOIN circle.mandate m ON m.role = p.role
    JOIN member.member mm ON mm.address = p.member
    WHERE p.member = may.actor
      AND mm.status = 'active'
      AND m.power = may.power
      AND (p.since IS NULL OR p.since <= may.day)
      AND (p.until IS NULL OR p.until > may.day)
      AND (m."from" IS NULL OR m."from" <= may.day)
      AND (m.until IS NULL OR m.until > may.day)
      AND m.revoked IS NULL
      AND (m."limit" IS NULL OR may.cents IS NULL OR may.cents <= cella.cents(m."limit"))
  );
END;

-- Every op with a power in cella.power — the actor holds it on the verdict
-- date, within the mandate's limit for the amount the payload names.
CREATE FUNCTION circle_member.empowered(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.amount IS NOT NULL AND w.cents IS NULL THEN w.op || ' names its amount in ' || w.amount || ', which the payload lacks'
    WHEN NOT circle_member.may(cella.actor(), w.power, w.cents, cella.verdict_date()) THEN
      cella.actor() || ' holds no mandate for ' || w.power
        || coalesce(' up to ' || cella.amount(w.cents)::text || ' €', '')
  END
  FROM (
    SELECT p.op, p.power, p.amount, (payload ->> p.amount)::bigint AS cents
    FROM cella.power p
    WHERE p.op = cella.op()
  ) w;
END;

-- The rule attaches to every op with a power: those the feats registered
-- before this graft migrated, and any registered after.
INSERT INTO cella.rule (op, fn, owner)
SELECT p.op, 'circle_member.empowered(jsonb)'::regprocedure, 'circle-member' FROM cella.power p;

CREATE FUNCTION circle_member.attach() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO cella.rule (op, fn, owner)
  VALUES (NEW.op, 'circle_member.empowered(jsonb)', 'circle-member');
  RETURN NULL;
END
$$;

CREATE TRIGGER attach AFTER INSERT ON cella.power
  FOR EACH ROW EXECUTE FUNCTION circle_member.attach();
