-- A mandate is a policy: a sentence a circle adopted by motion, marking
-- the role it grants to, or the circle for a collective mandate, the
-- power, and perhaps a limit per write or a budget over a month or a
-- year. Its values are copied into `circle.mandate` as it is adopted,
-- and its mandate revoked as it ends, in the same write; the register is
-- org's core's, read here by its values, never its wording.

-- What is wrong with a mandate's values, by name as written (`{"role":
-- "finance", "power": "pay-supplier", "limit": "3 000 €"}`), or null: it
-- marks a role this feat has or a circle it has, never both, a power in
-- lower case, at most a limit or a budget, each an amount, a budget with
-- its period, and nothing else.
CREATE FUNCTION circle.mandate_flaw(marked jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN x.other IS NOT NULL THEN 'a mandate marks its role or circle, power, limit, budget and per, not ' || x.other
    WHEN v.role IS NULL AND v.circle IS NULL THEN 'a mandate policy names its role, as {role: finance}, or its circle, as {circle: ag}'
    WHEN v.role IS NOT NULL AND v.circle IS NOT NULL THEN 'a mandate is on a role or on a circle, not both'
    WHEN v.role IS NOT NULL AND NOT EXISTS (SELECT FROM circle.role r WHERE r.id = v.role) THEN 'no role ' || v.role
    WHEN v.circle IS NOT NULL AND NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = v.circle) THEN 'no circle ' || v.circle
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

-- A mandate policy's values as the register types them: its role or its
-- circle, its power, its limit or budget in cents and its period, and its
-- days.
CREATE FUNCTION circle.mandated(ref text) RETURNS TABLE (
  role text, circle text, power text, "limit" bigint, budget bigint, per text, "from" date, until date
)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT max(v.value #>> '{}') FILTER (WHERE v.name = 'role'),
         max(v.value #>> '{}') FILTER (WHERE v.name = 'circle'),
         max(v.value #>> '{}') FILTER (WHERE v.name = 'power'),
         max((v.value #>> '{}')::bigint) FILTER (WHERE v.name = 'limit' AND v.type = 'amount'),
         max((v.value #>> '{}')::bigint) FILTER (WHERE v.name = 'budget' AND v.type = 'amount'),
         max(v.value #>> '{}') FILTER (WHERE v.name = 'per'),
         p.applies, p.ends
  FROM policy.policy p
  LEFT JOIN policy.value v ON v.policy = p.id
  WHERE p.id = mandated.ref AND p.kind = 'mandate'
  GROUP BY p.id, p.applies, p.ends;
END;

-- Copies a mandate policy's values into the mandate they grant, in the
-- write that adopts it, and revokes the mandate of the policy it
-- replaces the day it applies. Returns the mandate, or null for a policy
-- of another kind; values that grant no mandate are refused (SQLSTATE
-- 09000).
CREATE FUNCTION circle.mandate_from(ref text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  wrong text;
  made bigint;
BEGIN
  IF NOT EXISTS (SELECT FROM policy.policy p WHERE p.id = ref AND p.kind = 'mandate') THEN
    RETURN NULL;
  END IF;
  wrong := circle.mandate_flaw((SELECT jsonb_object_agg(v.name, v.literal) FROM policy.value v WHERE v.policy = ref));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  INSERT INTO circle.mandate (role, circle, power, policy, "limit", budget, per, "from", until)
  SELECT m.role, m.circle, m.power, ref, cella.amount(m."limit"), cella.amount(m.budget), m.per, m."from", m.until
  FROM circle.mandated(ref) m
  RETURNING id INTO made;
  UPDATE circle.mandate o SET revoked = p.applies
  FROM policy.policy p
  WHERE p.id = ref AND o.policy = p.replaces AND o.revoked IS NULL;
  RETURN made;
END
$$;

-- Revokes the mandate of a mandate policy that ended, on the day it
-- ended, in the write that ends it. Returns the mandate, or null.
CREATE FUNCTION circle.mandate_ended(ref text) RETURNS bigint
LANGUAGE sql
BEGIN ATOMIC
  UPDATE circle.mandate m SET revoked = p.ends
  FROM policy.policy p
  WHERE p.id = mandate_ended.ref AND m.policy = p.id AND p.kind = 'mandate' AND p.ends IS NOT NULL AND m.revoked IS NULL
  RETURNING m.id;
END;

-- motion:policy:adopt, which circle-motion attaches it to — a mandate
-- policy the write adopted has its mandate, on the role or the circle,
-- for the power, capped and on the days its values and its policy say;
-- the mandate of the policy it replaces is revoked the day it applies;
-- and a policy of another kind has none.
CREATE FUNCTION circle.grants(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.kind <> 'mandate' AND m.id IS NOT NULL THEN r.id || ', a ' || r.kind || ', grants no mandate'
    WHEN r.kind = 'mandate' AND m.id IS NULL THEN r.id || ' grants no mandate: its values are copied as it is adopted'
    WHEN r.kind = 'mandate' AND NOT EXISTS (
      SELECT FROM circle.mandated(r.id) v
      WHERE (m.role, m.circle, m.power, cella.cents(m."limit"), cella.cents(m.budget), m.per, m."from", m.until)
        IS NOT DISTINCT FROM (v.role, v.circle, v.power, v."limit", v.budget, v.per, v."from", v.until)
    ) THEN 'mandate ' || m.id || ' is not what ' || r.id || ' marks'
    WHEN r.kind = 'mandate' AND EXISTS (
      SELECT FROM circle.mandate o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies
    ) THEN 'the mandate of ' || r.replaces || ' is not revoked the day ' || r.id || ' applies'
  END
  FROM policy.policy r
  LEFT JOIN circle.mandate m ON m.policy = r.id
  WHERE r.id = payload ->> 'policy';
END;

-- motion:policy:end, which circle-motion attaches it to — the mandate of
-- a mandate policy the write ended is revoked the day it ends.
CREATE FUNCTION circle.revokes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'mandate ' || m.id || ' of ' || r.id || ' is not revoked the day it ends'
  FROM policy.policy r
  JOIN circle.mandate m ON m.policy = r.id
  WHERE r.id = payload ->> 'policy' AND r.kind = 'mandate' AND m.revoked IS DISTINCT FROM r.ends;
END;

-- Whether a circle holds a collective mandate in force for a power on a
-- day: a mandate on the circle itself, never one on a circle above or
-- below it, nor one on any of its roles. Only a motion of that circle
-- uses it, which the graft joining this feat to motions checks.
CREATE FUNCTION circle.holds(circle text, power text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle.mandate m
    WHERE m.circle = holds.circle
      AND m.power = holds.power
      AND (m."from" IS NULL OR m."from" <= holds.day)
      AND (m.until IS NULL OR m.until > holds.day)
      AND (m.revoked IS NULL OR m.revoked > holds.day)
  );
END;
