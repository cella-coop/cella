-- A mandate is a policy: a sentence a circle adopted by motion, marking
-- its grantee, the role it grants to or the circle for a collective
-- mandate, the power, and perhaps a limit per write or a budget over a
-- month or a year. A right is a policy of its own kind, no mandate: the
-- power the legal form gives every person, member or employee as such,
-- with no grantee. The values of each are copied into `circle.mandate`
-- or `circle.right` as it is adopted, and revoked as it ends, in the same
-- write; the register is org's core's, read here by its values, never its
-- wording.

-- What is wrong with a mandate's values, by name as written (`{"role":
-- "finance", "power": "pay-supplier", "limit": "3 000 €"}`), or null: it
-- marks one grantee, a role this feat has or a circle it has, never a
-- person nor a right, a power in lower case, at most a limit or a budget,
-- each an amount, a budget with its period, and nothing else.
CREATE FUNCTION circle.mandate_flaw(marked jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN marked ? 'person'
      THEN 'a person holds no mandate: a mandate names the role they hold, as {role: finance}, or a circle, as {circle: ag}'
    WHEN marked ? 'right' THEN 'a right is no mandate: it is a policy of its own kind, which the legal form gives'
    WHEN x.other IS NOT NULL THEN 'a mandate marks its role or circle, power, limit, budget and per, not ' || x.other
    WHEN num_nonnulls(v.role, v.circle) = 0
      THEN 'a mandate policy names its grantee, a role, as {role: finance}, or a circle, as {circle: ag}'
    WHEN num_nonnulls(v.role, v.circle) > 1 THEN 'a mandate has one grantee, a role or a circle'
    WHEN v.role IS NOT NULL AND NOT EXISTS (SELECT FROM circle.grantee g WHERE g.id = v.role AND g.kind = 'role') THEN 'no role ' || v.role
    WHEN v.circle IS NOT NULL AND NOT EXISTS (SELECT FROM circle.grantee g WHERE g.id = v.circle AND g.kind = 'circle') THEN 'no circle ' || v.circle
    WHEN coalesce(v.power, '') !~ '^[a-z][a-z-]*$' THEN 'a mandate names its power in lower case, as {power: approve-time}'
    WHEN v."limit" IS NOT NULL AND v.budget IS NOT NULL THEN 'a mandate caps by a limit per write or by a budget, not both'
    WHEN v."limit" IS NOT NULL AND (SELECT t.type FROM policy.typed('limit', v."limit") t) <> 'amount'
      THEN 'a limit is an amount, as 3 000 €, not ' || v."limit"
    WHEN v.budget IS NOT NULL AND (SELECT t.type FROM policy.typed('budget', v.budget) t) <> 'amount'
      THEN 'a budget is an amount, as 1 000 €, not ' || v.budget
    WHEN (v.budget IS NULL) <> (v.per IS NULL) OR v.per NOT IN ('month', 'year') THEN 'a budget runs per month or per year'
  END
  FROM (
    SELECT marked ->> 'role' AS role, marked ->> 'circle' AS circle, marked ->> 'power' AS power,
           marked ->> 'limit' AS "limit", marked ->> 'budget' AS budget, marked ->> 'per' AS per
  ) v,
  LATERAL (
    SELECT (SELECT k FROM jsonb_object_keys(coalesce(marked, '{}')) k
            WHERE k NOT IN ('role', 'circle', 'power', 'limit', 'budget', 'per') ORDER BY k LIMIT 1) AS other
  ) x;
END;

-- What is wrong with a right's values, or null: it marks the people it is
-- given to, every person, member or employee, a power in lower case,
-- perhaps a limit, an amount, and nothing else.
CREATE FUNCTION circle.right_flaw(marked jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN x.other IS NOT NULL THEN 'a right marks its right, power and limit, not ' || x.other
    WHEN v."right" IS NULL THEN 'a right policy names who it is given to, as {right: member}'
    WHEN v."right" NOT IN ('person', 'member', 'employee')
      THEN 'a right is given to every person, member or employee, as {right: member}, not ' || v."right"
    WHEN coalesce(v.power, '') !~ '^[a-z][a-z-]*$' THEN 'a right names its power in lower case, as {power: log-time}'
    WHEN v."limit" IS NOT NULL AND (SELECT t.type FROM policy.typed('limit', v."limit") t) <> 'amount'
      THEN 'a limit is an amount, as 3 000 €, not ' || v."limit"
  END
  FROM (
    SELECT marked ->> 'right' AS "right", marked ->> 'power' AS power, marked ->> 'limit' AS "limit"
  ) v,
  LATERAL (
    SELECT (SELECT k FROM jsonb_object_keys(coalesce(marked, '{}')) k
            WHERE k NOT IN ('right', 'power', 'limit') ORDER BY k LIMIT 1) AS other
  ) x;
END;

-- A mandate or right policy's values as the register types them: its
-- grantee, the role or the circle it marks, or its right, its power, its
-- limit or budget in cents and its period, and its days.
CREATE FUNCTION circle.mandated(ref text) RETURNS TABLE (
  grantee text, "right" text, power text, "limit" bigint, budget bigint, per text, "from" date, until date
)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(max(v.value #>> '{}') FILTER (WHERE v.name = 'role'), max(v.value #>> '{}') FILTER (WHERE v.name = 'circle')),
         max(v.value #>> '{}') FILTER (WHERE v.name = 'right'),
         max(v.value #>> '{}') FILTER (WHERE v.name = 'power'),
         max((v.value #>> '{}')::bigint) FILTER (WHERE v.name = 'limit' AND v.type = 'amount'),
         max((v.value #>> '{}')::bigint) FILTER (WHERE v.name = 'budget' AND v.type = 'amount'),
         max(v.value #>> '{}') FILTER (WHERE v.name = 'per'),
         p.applies, p.ends
  FROM policy.policy p
  LEFT JOIN policy.value v ON v.policy = p.id
  WHERE p.id = mandated.ref AND p.kind IN ('mandate', 'right')
  GROUP BY p.id, p.applies, p.ends;
END;

-- The mandate a mandate policy is issued under, or null: none where its
-- issuer, the circle that adopted it, is the assembly, whose mandates are
-- roots; else the first of the issuer's mandates for the power, standing
-- on the day the policy applies, that its values are narrower than
-- (`circle.wider`), or the first standing at all, which `circle.narrows`
-- then refuses saying how it is wider.
CREATE FUNCTION circle.parent_of(ref text) RETURNS bigint
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT u.id
  FROM policy.policy p
  CROSS JOIN circle.mandated(parent_of.ref) v
  JOIN circle.mandate u ON u.grantee = p.circle AND u.power = v.power AND u.policy <> p.id AND u.policy IS DISTINCT FROM p.replaces
  WHERE p.id = parent_of.ref
    AND NOT EXISTS (SELECT FROM circle.circle r WHERE r.id = p.circle AND r.parent IS NULL)
    AND (u.revoked IS NULL OR u.revoked > p.applies)
    AND (u.until IS NULL OR u.until > p.applies)
  ORDER BY circle.wider(v.power, cella.amount(v."limit"), cella.amount(v.budget), v.per, v."from", v.until, u.id) IS NULL DESC, u.id
  LIMIT 1;
END;

-- Copies a mandate policy's values into the mandate they grant, with its
-- issuer and the mandate it is issued under, or a
-- right policy's into the right, in the write that adopts it, and revokes
-- the mandate or the right of the policy it replaces the day it applies.
-- Returns the mandate, or null for a right or a policy of another kind;
-- values that grant nothing are refused (SQLSTATE 09000).
CREATE FUNCTION circle.mandate_from(ref text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  k text;
  marked jsonb;
  wrong text;
  made bigint;
BEGIN
  SELECT p.kind INTO k FROM policy.policy p WHERE p.id = ref AND p.kind IN ('mandate', 'right');
  IF k IS NULL THEN
    RETURN NULL;
  END IF;
  marked := (SELECT jsonb_object_agg(v.name, v.literal) FROM policy.value v WHERE v.policy = ref);
  wrong := CASE k WHEN 'mandate' THEN circle.mandate_flaw(marked) ELSE circle.right_flaw(marked) END;
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF k = 'mandate' THEN
    INSERT INTO circle.mandate (grantee, issuer, parent, power, policy, "limit", budget, per, "from", until)
    SELECT m.grantee, p.circle, circle.parent_of(ref), m.power, ref, cella.amount(m."limit"), cella.amount(m.budget), m.per, m."from", m.until
    FROM circle.mandated(ref) m
    JOIN policy.policy p ON p.id = ref
    RETURNING id INTO made;
    UPDATE circle.mandate o SET revoked = p.applies
    FROM policy.policy p
    WHERE p.id = ref AND o.policy = p.replaces AND o.revoked IS NULL;
  ELSE
    INSERT INTO circle.right ("right", power, policy, "limit", "from", until)
    SELECT m."right", m.power, ref, cella.amount(m."limit"), m."from", m.until
    FROM circle.mandated(ref) m;
    UPDATE circle.right o SET revoked = p.applies
    FROM policy.policy p
    WHERE p.id = ref AND o.policy = p.replaces AND o.revoked IS NULL;
  END IF;
  RETURN made;
END
$$;

-- Revokes the mandate or the right of a policy that ended, on the day it
-- ended, in the write that ends it. Returns the mandate, or null.
CREATE FUNCTION circle.mandate_ended(ref text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  made bigint;
BEGIN
  UPDATE circle.right r SET revoked = p.ends
  FROM policy.policy p
  WHERE p.id = ref AND r.policy = p.id AND p.kind = 'right' AND p.ends IS NOT NULL AND r.revoked IS NULL;
  UPDATE circle.mandate m SET revoked = p.ends
  FROM policy.policy p
  WHERE p.id = ref AND m.policy = p.id AND p.kind = 'mandate' AND p.ends IS NOT NULL AND m.revoked IS NULL
  RETURNING m.id INTO made;
  RETURN made;
END
$$;

-- motion:policy:adopt, which circle-motion attaches it to — a mandate
-- policy the write adopted has its mandate, to the grantee, issued by
-- the circle that adopted it under the parent it holds, for the
-- power, capped and on the days its values and its policy say, and a
-- right policy its right; the mandate or the right of the policy it
-- replaces is revoked the day it applies; and a policy of another kind
-- has neither.
CREATE FUNCTION circle.grants(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.kind NOT IN ('mandate', 'right') AND (m.id IS NOT NULL OR g.id IS NOT NULL)
      THEN r.id || ', a ' || r.kind || ', grants no mandate and gives no right'
    WHEN r.kind = 'mandate' AND (m.id IS NULL OR g.id IS NOT NULL)
      THEN r.id || ' grants no mandate: its values are copied as it is adopted'
    WHEN r.kind = 'right' AND (g.id IS NULL OR m.id IS NOT NULL)
      THEN r.id || ' gives no right: its values are copied as it is adopted'
    WHEN r.kind = 'mandate' AND NOT EXISTS (
      SELECT FROM circle.mandated(r.id) v
      WHERE (m.grantee, m.power, cella.cents(m."limit"), cella.cents(m.budget), m.per, m."from", m.until)
        IS NOT DISTINCT FROM (v.grantee, v.power, v."limit", v.budget, v.per, v."from", v.until)
    ) THEN 'mandate ' || m.id || ' is not what ' || r.id || ' marks'
    WHEN r.kind = 'mandate' AND (m.issuer <> r.circle OR m.parent IS DISTINCT FROM circle.parent_of(r.id))
      THEN 'mandate ' || m.id || ' is not issued by ' || r.circle || ', which adopted ' || r.id || ', under the mandate it holds for ' || m.power
    WHEN r.kind = 'right' AND NOT EXISTS (
      SELECT FROM circle.mandated(r.id) v
      WHERE (g."right", g.power, cella.cents(g."limit"), g."from", g.until)
        IS NOT DISTINCT FROM (v."right", v.power, v."limit", v."from", v.until)
    ) THEN 'right ' || g.id || ' is not what ' || r.id || ' marks'
    WHEN EXISTS (SELECT FROM circle.mandate o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies)
      OR EXISTS (SELECT FROM circle.right o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies)
      THEN 'what ' || r.replaces || ' granted is not revoked the day ' || r.id || ' applies'
  END
  FROM policy.policy r
  LEFT JOIN circle.mandate m ON m.policy = r.id
  LEFT JOIN circle.right g ON g.policy = r.id
  WHERE r.id = payload ->> 'policy';
END;

-- motion:policy:end, which circle-motion attaches it to — the mandate or
-- the right of a policy the write ended is revoked the day it ends.
CREATE FUNCTION circle.revokes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    (SELECT 'mandate ' || m.id || ' of ' || r.id || ' is not revoked the day it ends'
     FROM circle.mandate m WHERE m.policy = r.id AND r.kind = 'mandate' AND m.revoked IS DISTINCT FROM r.ends),
    (SELECT 'right ' || g.id || ' of ' || r.id || ' is not revoked the day it ends'
     FROM circle.right g WHERE g.policy = r.id AND r.kind = 'right' AND g.revoked IS DISTINCT FROM r.ends)
  )
  FROM policy.policy r
  WHERE r.id = payload ->> 'policy';
END;

-- Whether a circle holds a collective mandate in force for a power on a
-- day: a mandate whose grantee is the circle itself, never one on a
-- circle above or below it, nor one on any of its roles. Only a motion of
-- that circle uses it, which the graft joining this feat to motions
-- checks.
CREATE FUNCTION circle.holds(circle text, power text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle.mandate m
    JOIN circle.grantee g ON g.id = m.grantee AND g.kind = 'circle'
    WHERE m.grantee = holds.circle
      AND m.power = holds.power
      AND (m."from" IS NULL OR m."from" <= holds.day)
      AND (m.until IS NULL OR m.until > holds.day)
      AND (m.revoked IS NULL OR m.revoked > holds.day)
  );
END;
