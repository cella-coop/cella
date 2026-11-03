-- Authority flows down the mandates. Every mandate has an issuer, the
-- circle whose motion adopted its policy, and every one the assembly did
-- not issue has a parent: a mandate its issuer holds as a whole for the
-- same power. So the mandates form a provenance tree by `parent`, whose
-- roots are the assembly's, the founding motion's first from the legal
-- form, and what is under a circle or a role is what it issued, never
-- where it sits. A mandate is narrower than its parent: the same power,
-- a cap no wider and a term no longer.

-- A mandate's cap in words: up to a limit a write, within a budget a
-- period, or uncapped.
CREATE FUNCTION circle.cap("limit" cella.amount, budget cella.amount, per text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce('up to ' || cap."limit"::text || ' € a write', 'within ' || cap.budget::text || ' € a ' || cap.per, 'uncapped');
END;

-- How a mandate of these values is wider than the mandate `parent`, as a
-- reason, or NULL when it is narrower: another power; a cap wider than
-- the parent's, where the parent is capped, which a limit per write at
-- most its limit or a budget over the same period at most its budget is
-- not; a term from before the parent's, or until after it.
CREATE FUNCTION circle.wider(
  power text, "limit" cella.amount, budget cella.amount, per text, "from" date, until date, parent bigint
) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN u.power <> wider.power THEN 'it grants ' || wider.power || ', not its parent''s ' || u.power
    WHEN (u."limit" IS NOT NULL OR u.budget IS NOT NULL)
      AND NOT coalesce(cella.cents(wider."limit") <= cella.cents(u."limit"), false)
      AND NOT coalesce(wider.per = u.per AND cella.cents(wider.budget) <= cella.cents(u.budget), false)
      THEN 'its cap, ' || circle.cap(wider."limit", wider.budget, wider.per)
        || ', is wider than its parent''s, ' || circle.cap(u."limit", u.budget, u.per)
    WHEN wider."from" < u."from" THEN 'it applies from ' || wider."from" || ', before its parent, from ' || u."from"
    WHEN u.until IS NOT NULL AND (wider.until IS NULL OR wider.until > u.until)
      THEN 'it outlasts its parent, which ends on ' || u.until
  END
  FROM circle.mandate u
  WHERE u.id = wider.parent;
END;

-- The first mandate standing on `day`, in force or yet to be, that is
-- neither a root the assembly issued nor issued under a parent its issuer
-- holds, standing with it, that it is narrower than, as a reason; or NULL
-- when every one is.
CREATE FUNCTION circle.overreach(day date) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'mandate ' || m.id || ' grants ' || m.power || ' to ' || m.grantee || ', issued by ' || m.issuer || CASE
      WHEN u.id IS NULL THEN ', which holds no mandate for ' || m.power || ' to issue it under'
      WHEN u.grantee <> m.issuer THEN ', under mandate ' || u.id || ', which is ' || u.grantee || '''s'
      WHEN u.revoked <= overreach.day
        THEN ', under mandate ' || u.id || ', revoked on ' || u.revoked || ': end the mandates issued under it first'
      ELSE ', is wider than mandate ' || u.id || ' it is issued under: '
        || circle.wider(m.power, m."limit", m.budget, m.per, m."from", m.until, u.id)
    END
  FROM circle.mandate m
  LEFT JOIN circle.mandate u ON u.id = m.parent
  WHERE (m.revoked IS NULL OR m.revoked > overreach.day)
    AND (m.until IS NULL OR m.until > overreach.day)
    AND NOT (m.parent IS NULL AND EXISTS (SELECT FROM circle.circle r WHERE r.id = m.issuer AND r.parent IS NULL))
    AND (u.id IS NULL
      OR u.grantee <> m.issuer
      OR u.revoked <= overreach.day
      OR circle.wider(m.power, m."limit", m.budget, m.per, m."from", m.until, u.id) IS NOT NULL)
  ORDER BY m.id
  LIMIT 1;
END;

-- The adoption and end of a mandate policy, to which circle-motion
-- attaches it — after the write, every mandate standing is a root the
-- assembly issued, or is issued under a parent its issuer holds and is
-- narrower than it: a grant its issuer holds nothing to issue under, or
-- wider than its parent, is refused, as is an end that leaves a mandate
-- issued under one that no longer stands.
CREATE FUNCTION circle.narrows(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.overreach(cella.verdict_date());
END;

-- A mandate's chain, from its root down to itself: each mandate on it,
-- its grantee and its issuer, and its depth, the root's 0.
CREATE FUNCTION circle.chain(mandate bigint) RETURNS TABLE (id bigint, grantee text, issuer text, depth int)
LANGUAGE sql STABLE
BEGIN ATOMIC
  WITH RECURSIVE up AS (
    SELECT m.id, m.grantee, m.issuer, m.parent, 0 AS height FROM circle.mandate m WHERE m.id = chain.mandate
    UNION ALL
    SELECT m.id, m.grantee, m.issuer, m.parent, up.height + 1 FROM circle.mandate m JOIN up ON m.id = up.parent
  )
  SELECT up.id, up.grantee, up.issuer, (max(up.height) OVER () - up.height)::int
  FROM up
  ORDER BY up.height DESC;
END;
