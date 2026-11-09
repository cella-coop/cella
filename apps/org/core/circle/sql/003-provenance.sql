-- Authority flows down the mandates. Every mandate has an issuer, the
-- circle whose motion adopted its policy, and every one the assembly did
-- not issue has a parent: a mandate its issuer holds as a whole for the
-- same power. So the mandates form a provenance tree by `parent`, whose
-- roots are the assembly's, the founding motion's first from the legal
-- form, and what is under a circle or a role is what it issued, never
-- where it sits, since circles never nest. A mandate is narrower than its parent: the same power,
-- a cap and a scope no wider and a term no longer. Revoking a mandate revokes every
-- mandate issued under it, down the tree, on the same day.

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
-- not; a scope wider than the parent's, where the parent is scoped, which
-- only the same scope is not; a term from before the parent's, or until
-- after it.
CREATE FUNCTION circle.wider(
  power text, "limit" cella.amount, budget cella.amount, per text, scope text, "from" date, until date, parent bigint
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
    WHEN u.scope IS NOT NULL AND wider.scope IS DISTINCT FROM u.scope
      THEN 'it covers ' || coalesce(wider.scope, 'the whole co-op') || ', wider than its parent, which covers ' || u.scope || ' alone'
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
        THEN ', under mandate ' || u.id || ', revoked on ' || u.revoked || ', which revokes every mandate issued under it'
      ELSE ', is wider than mandate ' || u.id || ' it is issued under: '
        || circle.wider(m.power, m."limit", m.budget, m.per, m.scope, m."from", m.until, u.id)
    END
  FROM circle.mandate m
  LEFT JOIN circle.mandate u ON u.id = m.parent
  WHERE (m.revoked IS NULL OR m.revoked > overreach.day)
    AND (m.until IS NULL OR m.until > overreach.day)
    AND NOT (m.parent IS NULL AND m.issuer = circle.assembly())
    AND (u.id IS NULL
      OR u.grantee <> m.issuer
      OR u.revoked <= overreach.day
      OR circle.wider(m.power, m."limit", m.budget, m.per, m.scope, m."from", m.until, u.id) IS NOT NULL)
  ORDER BY m.id
  LIMIT 1;
END;

-- The adoption and end of a mandate policy, to which the motion feat
-- attaches it — after the write, every mandate standing is a root the
-- assembly issued, or is issued under a parent its issuer holds and is
-- narrower than it: a grant its issuer holds nothing to issue under, or
-- wider than its parent, is refused, as is a write that leaves a mandate
-- standing under one that no longer stands, which `circle.revoke` revokes
-- with it.
CREATE FUNCTION circle.narrows(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.overreach(cella.verdict_date());
END;

-- A mandate's chain, from its root down to itself: each mandate on it,
-- its grantee and its issuer, and its depth, the root's 0. It reads as
-- its caller reads `circle.mandate`, so it stops below the first link
-- they do not read, the highest they read at depth 0, whose parent is
-- what tells it from the root.
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

-- A mandate and every mandate issued under it, down its provenance tree,
-- with the depth of each below it, its own 0.
CREATE FUNCTION circle.under(mandate bigint) RETURNS TABLE (id bigint, depth int)
LANGUAGE sql STABLE
BEGIN ATOMIC
  WITH RECURSIVE down AS (
    SELECT m.id, 0 AS depth FROM circle.mandate m WHERE m.id = under.mandate
    UNION ALL
    SELECT m.id, down.depth + 1 FROM circle.mandate m JOIN down ON m.parent = down.id
  )
  SELECT down.id, down.depth FROM down ORDER BY down.depth, down.id;
END;

-- Revokes a mandate on `day`, and with it every mandate issued under it,
-- down its provenance tree, that still stands then: one revoked later,
-- or not at all, is revoked that day; one revoked or expired by then is
-- left as it is. Returns those it revoked, the mandate first, then down
-- the tree.
CREATE FUNCTION circle.revoke(mandate bigint, day date) RETURNS bigint[]
LANGUAGE plpgsql AS $$
DECLARE
  done bigint[];
BEGIN
  WITH gone AS (
    UPDATE circle.mandate m SET revoked = revoke.day
    FROM circle.under(revoke.mandate) u
    WHERE m.id = u.id
      AND (m.revoked IS NULL OR m.revoked > revoke.day)
      AND (m.until IS NULL OR m.until > revoke.day)
    RETURNING m.id, u.depth
  )
  SELECT coalesce(array_agg(g.id ORDER BY g.depth, g.id), '{}') INTO done FROM gone g;
  RETURN done;
END
$$;

-- The first mandate issued under `mandate`, down its tree, that still
-- stands after `day`, as a reason; or NULL when none does, as revoking
-- the mandate that day leaves it.
CREATE FUNCTION circle.outlives(mandate bigint, day date) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'mandate ' || m.id || ', issued under mandate ' || outlives.mandate || ', is not revoked with it on ' || outlives.day
  FROM circle.under(outlives.mandate) u
  JOIN circle.mandate m ON m.id = u.id
  WHERE u.depth > 0
    AND (m.revoked IS NULL OR m.revoked > outlives.day)
    AND (m.until IS NULL OR m.until > outlives.day)
  ORDER BY u.depth, m.id
  LIMIT 1;
END;
