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
-- each an amount, a budget with its period, perhaps a procedure by name,
-- perhaps a scope, a circle it has or `own`, and nothing else.
CREATE FUNCTION circle.mandate_flaw(marked jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN marked ? 'person'
      THEN 'a person holds no mandate: a mandate names the role they hold, as {role: finance}, or a circle, as {circle: ag}'
    WHEN marked ? 'right' THEN 'a right is no mandate: it is a policy of its own kind, which the legal form gives'
    WHEN x.other IS NOT NULL THEN 'a mandate marks its role or circle, power, limit, budget, per, procedure and scope, not ' || x.other
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
    WHEN v.procedure IS NOT NULL AND btrim(v.procedure) !~ '^[a-z][a-z-]*$'
      THEN 'a mandate names its procedure in lower case, as {procedure: ordinary}, not ' || v.procedure
    WHEN v.scope IS NOT NULL AND btrim(v.scope) <> 'own'
      AND NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = btrim(v.scope))
      THEN 'a mandate''s scope is a circle, as {scope: web}, or its holder''s own, as {scope: own}, not ' || v.scope
  END
  FROM (
    SELECT marked ->> 'role' AS role, marked ->> 'circle' AS circle, marked ->> 'power' AS power,
           marked ->> 'limit' AS "limit", marked ->> 'budget' AS budget, marked ->> 'per' AS per,
           marked ->> 'procedure' AS procedure, marked ->> 'scope' AS scope
  ) v,
  LATERAL (
    SELECT (SELECT k FROM jsonb_object_keys(coalesce(marked, '{}')) k
            WHERE k NOT IN ('role', 'circle', 'power', 'limit', 'budget', 'per', 'procedure', 'scope') ORDER BY k LIMIT 1) AS other
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
-- limit or budget in cents and its period, its procedure, its scope, and
-- its days.
CREATE FUNCTION circle.mandated(ref text) RETURNS TABLE (
  grantee text, "right" text, power text, "limit" bigint, budget bigint, per text, procedure text, scope text, "from" date, until date
)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(max(v.value #>> '{}') FILTER (WHERE v.name = 'role'), max(v.value #>> '{}') FILTER (WHERE v.name = 'circle')),
         max(v.value #>> '{}') FILTER (WHERE v.name = 'right'),
         max(v.value #>> '{}') FILTER (WHERE v.name = 'power'),
         max((v.value #>> '{}')::bigint) FILTER (WHERE v.name = 'limit' AND v.type = 'amount'),
         max((v.value #>> '{}')::bigint) FILTER (WHERE v.name = 'budget' AND v.type = 'amount'),
         max(v.value #>> '{}') FILTER (WHERE v.name = 'per'),
         max(btrim(v.value #>> '{}')) FILTER (WHERE v.name = 'procedure'),
         max(btrim(v.value #>> '{}')) FILTER (WHERE v.name = 'scope'),
         p.applies, p.ends
  FROM policy.policy p
  LEFT JOIN policy.value v ON v.policy = p.id
  WHERE p.id = mandated.ref AND p.kind IN ('mandate', 'right')
  GROUP BY p.id, p.applies, p.ends;
END;

-- The mandate a mandate of these values, issued by `issuer` from the day
-- `from`, would be issued under, or null: none where the issuer is the
-- assembly, whose mandates are roots; else the first of the issuer's
-- mandates for the power, standing on that day, that the values are
-- narrower than (`circle.wider`), or the first standing at all, which
-- `circle.narrows` then refuses saying how it is wider; never one of
-- `besides`, the policy itself and the one it replaces. So a grant is
-- judged before its policy exists, as the motion feat's form asks, by
-- the SQL that finds its parent as it is adopted.
CREATE FUNCTION circle.parent_for(
  issuer text, power text, "limit" cella.amount, budget cella.amount, per text, scope text, "from" date, until date, besides text[] DEFAULT '{}'
) RETURNS bigint
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT u.id
  FROM circle.mandate u
  WHERE u.grantee = parent_for.issuer AND u.power = parent_for.power
    AND NOT coalesce(u.policy = ANY (parent_for.besides), false)
    AND parent_for.issuer IS DISTINCT FROM circle.assembly()
    AND (u.revoked IS NULL OR u.revoked > parent_for."from")
    AND (u.until IS NULL OR u.until > parent_for."from")
  ORDER BY circle.wider(parent_for.power, parent_for."limit", parent_for.budget, parent_for.per, parent_for.scope,
                        parent_for."from", parent_for.until, u.id) IS NULL DESC, u.id
  LIMIT 1;
END;

-- The mandate a mandate policy is issued under, or null: its values'
-- parent (`circle.parent_for`), issued by the circle that adopted it from
-- the day it applies, besides itself and the policy it replaces.
CREATE FUNCTION circle.parent_of(ref text) RETURNS bigint
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.parent_for(p.circle, v.power, cella.amount(v."limit"), cella.amount(v.budget), v.per, v.scope, p.applies, v.until, ARRAY[p.id, p.replaces])
  FROM policy.policy p
  CROSS JOIN circle.mandated(parent_of.ref) v
  WHERE p.id = parent_of.ref;
END;

-- What is wrong with open books' disclosure rule, by its marks as
-- written, each name with its literal and the way it says is stricter
-- (`{"disclosure_contributors": {"literal": "5", "stricter": "more"}}`),
-- and the circle adopting it, or null: null too for a rule marking none
-- of the three. It is the assembly's, and marks the fewest people a
-- total may count, a whole number from 2 to 200, more stricter; the most
-- one may put in, a share from 20 % to 100 %, and the most two may, from
-- 40 % to 100 % and no less than one's, each less stricter; and nothing
-- else.
CREATE FUNCTION circle.disclosure_flaw(marks jsonb, issuer text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (SELECT FROM jsonb_object_keys(coalesce(marks, '{}')) k WHERE k LIKE 'disclosure\_%') THEN NULL
    WHEN issuer IS DISTINCT FROM circle.assembly()
      THEN 'open books'' disclosure rule is the assembly''s: only a motion of the assembly adopts it'
    WHEN x.other IS NOT NULL
      THEN 'a disclosure rule marks disclosure_contributors, disclosure_largest and disclosure_two, and nothing else, not ' || x.other
    WHEN NOT (marks ? 'disclosure_contributors' AND marks ? 'disclosure_largest' AND marks ? 'disclosure_two')
      THEN 'a disclosure rule marks all three of disclosure_contributors, disclosure_largest and disclosure_two'
    WHEN v.contributors IS NULL OR v.contributors <> trunc(v.contributors) OR v.contributors NOT BETWEEN 2 AND 200
      THEN 'disclosure_contributors is the fewest people a total may count, a whole number from 2 to 200, as 5, not ' || (marks #>> '{disclosure_contributors,literal}')
    WHEN marks #>> '{disclosure_contributors,stricter}' IS DISTINCT FROM 'more'
      THEN 'more people is stricter: {disclosure_contributors: ' || (marks #>> '{disclosure_contributors,literal}') || ' | more is stricter}'
    WHEN v.largest IS NULL OR v.largest NOT BETWEEN 20 AND 100
      THEN 'disclosure_largest is the most of a total one person may put in, a share from 20 % to 100 %, as 50 %, not ' || (marks #>> '{disclosure_largest,literal}')
    WHEN marks #>> '{disclosure_largest,stricter}' IS DISTINCT FROM 'less'
      THEN 'a smaller share is stricter: {disclosure_largest: ' || (marks #>> '{disclosure_largest,literal}') || ' | less is stricter}'
    WHEN v.two IS NULL OR v.two NOT BETWEEN 40 AND 100
      THEN 'disclosure_two is the most of a total two people may put in, a share from 40 % to 100 %, as 80 %, not ' || (marks #>> '{disclosure_two,literal}')
    WHEN marks #>> '{disclosure_two,stricter}' IS DISTINCT FROM 'less'
      THEN 'a smaller share is stricter: {disclosure_two: ' || (marks #>> '{disclosure_two,literal}') || ' | less is stricter}'
    WHEN v.two < v.largest
      THEN 'two people put in at least what one does: disclosure_two, ' || (marks #>> '{disclosure_two,literal}')
        || ', is no less than disclosure_largest, ' || (marks #>> '{disclosure_largest,literal}')
  END
  FROM (
    SELECT (SELECT (t.value #>> '{}')::numeric FROM policy.typed('disclosure_contributors', marks #>> '{disclosure_contributors,literal}') t WHERE t.type = 'number') AS contributors,
           (SELECT (t.value #>> '{}')::numeric FROM policy.typed('disclosure_largest', marks #>> '{disclosure_largest,literal}') t WHERE t.type = 'share') AS largest,
           (SELECT (t.value #>> '{}')::numeric FROM policy.typed('disclosure_two', marks #>> '{disclosure_two,literal}') t WHERE t.type = 'share') AS two
  ) v,
  LATERAL (
    SELECT (SELECT k FROM jsonb_object_keys(coalesce(marks, '{}')) k
            WHERE k NOT IN ('disclosure_contributors', 'disclosure_largest', 'disclosure_two') ORDER BY k LIMIT 1) AS other
  ) x;
END;

-- A policy's marks as `circle.disclosure_flaw` reads them, from the
-- register.
CREATE FUNCTION circle.marks_of(ref text) RETURNS jsonb
LANGUAGE sql STABLE
RETURN (SELECT jsonb_object_agg(v.name, jsonb_build_object('literal', v.literal, 'stricter', v.stricter))
        FROM policy.value v WHERE v.policy = ref);

-- A disclosure rule's values as the register types them, and its days;
-- no row for a policy that marks none of them.
CREATE FUNCTION circle.disclosure_of(ref text) RETURNS TABLE (contributors integer, largest numeric, two numeric, "from" date, until date)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT max((v.value #>> '{}')::numeric) FILTER (WHERE v.name = 'disclosure_contributors')::integer,
         max((v.value #>> '{}')::numeric) FILTER (WHERE v.name = 'disclosure_largest'),
         max((v.value #>> '{}')::numeric) FILTER (WHERE v.name = 'disclosure_two'),
         p.applies, p.ends
  FROM policy.policy p
  JOIN policy.value v ON v.policy = p.id
  WHERE p.id = disclosure_of.ref AND p.kind = 'rule' AND v.type IN ('number', 'share')
  GROUP BY p.id, p.applies, p.ends
  HAVING bool_or(v.name LIKE 'disclosure\_%');
END;

-- What is wrong with a disclosure rule or a publication applying from
-- `day`, perhaps until `until`, and replacing `replaces`, or null: one of
-- each stands at a time, so one whose days meet those of another of its
-- kind not yet revoked by then replaces that one, and the refusal names
-- it. `made` is the rule itself, once adopted. `what` is `disclosure` or
-- `publication`.
CREATE FUNCTION circle.overlap_flaw(what text, day date, until date, replaces text, made text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT o.policy || CASE overlap_flaw.what WHEN 'disclosure' THEN ' sets open books'' disclosure values' ELSE ' publishes parts of the structure' END
    || ' from ' || to_char(o."from", 'YYYY-MM-DD') || coalesce(' until ' || to_char(o.ends, 'YYYY-MM-DD'), '')
    || ': one ' || CASE overlap_flaw.what WHEN 'disclosure' THEN 'disclosure rule' ELSE 'publication' END
    || ' stands at a time, so one on days that meet its replaces ' || o.policy
  FROM (
    SELECT d.id, d.policy, d."from", least(d.until, d.revoked) AS ends FROM circle.disclosure d WHERE overlap_flaw.what = 'disclosure'
    UNION ALL
    SELECT p.id, p.policy, p."from", least(p.until, p.revoked) FROM circle.publication p WHERE overlap_flaw.what = 'publication'
  ) o
  WHERE o.policy IS DISTINCT FROM overlap_flaw.replaces AND o.policy IS DISTINCT FROM overlap_flaw.made
    AND (o.ends IS NULL OR o.ends > overlap_flaw.day)
    AND (overlap_flaw.until IS NULL OR o."from" < overlap_flaw.until)
    AND (o.ends IS NULL OR o."from" < o.ends)
  ORDER BY o."from", o.id
  LIMIT 1;
END;

-- Copies open books' disclosure rule into `circle.disclosure` in the
-- write that adopts it, and revokes the values of the policy it replaces
-- the day it applies, whatever it is. Returns the row it made, or null
-- for a policy that marks no disclosure value; a rule whose values are
-- unsound, or whose days meet another's it does not replace
-- (`circle.overlap_flaw`), is refused (SQLSTATE 09000).
CREATE FUNCTION circle.disclosure_from(ref text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  wrong text;
  made bigint;
BEGIN
  UPDATE circle.disclosure o SET revoked = p.applies
  FROM policy.policy p
  WHERE p.id = ref AND o.policy = p.replaces AND o.revoked IS NULL;
  IF NOT EXISTS (SELECT FROM policy.policy p WHERE p.id = ref AND p.kind = 'rule')
    OR NOT EXISTS (SELECT FROM policy.value v WHERE v.policy = ref AND v.name LIKE 'disclosure\_%') THEN
    RETURN NULL;
  END IF;
  wrong := coalesce(
    circle.disclosure_flaw(circle.marks_of(ref), (SELECT p.circle FROM policy.policy p WHERE p.id = ref)),
    (SELECT circle.overlap_flaw('disclosure', p.applies, p.ends, p.replaces, p.id) FROM policy.policy p WHERE p.id = ref));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  INSERT INTO circle.disclosure (policy, contributors, largest, two, "from", until)
  SELECT ref, d.contributors, d.largest, d.two, d."from", d.until
  FROM circle.disclosure_of(ref) d
  RETURNING id INTO made;
  RETURN made;
END
$$;

-- Revokes the disclosure values of a rule that ended, on the day it
-- ended, in the write that ends it.
CREATE FUNCTION circle.disclosure_ended(ref text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE circle.disclosure d SET revoked = p.ends
  FROM policy.policy p
  WHERE p.id = disclosure_ended.ref AND d.policy = p.id AND p.ends IS NOT NULL AND d.revoked IS NULL;
END;

-- Open books' disclosure values in force on a day: those of the one
-- rule standing then (`circle.overlap_flaw`), none where no rule stands.
CREATE FUNCTION circle.disclosed(day date) RETURNS TABLE (policy text, contributors integer, largest numeric, two numeric)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT d.policy, d.contributors, d.largest, d.two
  FROM circle.disclosure d
  WHERE d."from" <= disclosed.day
    AND (d.until IS NULL OR d.until > disclosed.day)
    AND (d.revoked IS NULL OR d.revoked > disclosed.day)
  ORDER BY d."from" DESC, d.id DESC
  LIMIT 1;
END;

-- The parts a publication's literal names, in its order: a list by
-- commas and a last `and`, each trimmed and in lower case.
CREATE FUNCTION circle.parts(literal text) RETURNS text[]
LANGUAGE sql IMMUTABLE
RETURN ARRAY(
  SELECT btrim(t.p)
  FROM regexp_split_to_table(lower(coalesce(literal, '')), '\s*,\s*(and\s+)?|\s+and\s+') WITH ORDINALITY AS t(p, n)
  WHERE btrim(t.p) <> ''
  ORDER BY t.n
);

-- What is wrong with the publication, by its marks as written, as
-- `circle.disclosure_flaw` reads them, and the circle adopting it, or
-- null: null too for a rule marking no `publish`. It is the assembly's,
-- marks `publish` and nothing else, and names at least one part, each
-- of circles, roles, mandates, seats and register.
CREATE FUNCTION circle.publication_flaw(marks jsonb, issuer text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT coalesce(marks, '{}') ? 'publish' THEN NULL
    WHEN issuer IS DISTINCT FROM circle.assembly()
      THEN 'what of its structure the co-op publishes is the assembly''s: only a motion of the assembly adopts it'
    WHEN x.other IS NOT NULL
      THEN 'a publication marks publish and nothing else, not ' || x.other
    WHEN cardinality(x.parts) = 0
      THEN 'a publication names what it publishes, any of circles, roles, mandates, seats and register, as {publish: circles and roles}'
    WHEN x.unknown IS NOT NULL
      THEN 'a publication publishes any of circles, roles, mandates, seats and register, as {publish: circles and roles}, not ' || x.unknown
  END
  FROM (
    SELECT v.parts,
           (SELECT k FROM jsonb_object_keys(coalesce(marks, '{}')) k WHERE k <> 'publish' ORDER BY k LIMIT 1) AS other,
           (SELECT u.p FROM unnest(v.parts) WITH ORDINALITY AS u(p, n)
            WHERE u.p <> ALL (ARRAY['circles', 'roles', 'mandates', 'seats', 'register']) ORDER BY u.n LIMIT 1) AS unknown
    FROM (SELECT circle.parts(marks #>> '{publish,literal}') AS parts) v
  ) x;
END;

-- The publication's parts as its rule names them, and its days; no row
-- for a policy that marks no `publish`.
CREATE FUNCTION circle.publication_of(ref text) RETURNS TABLE (parts text[], "from" date, until date)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.parts(v.literal), p.applies, p.ends
  FROM policy.policy p
  JOIN policy.value v ON v.policy = p.id AND v.name = 'publish'
  WHERE p.id = publication_of.ref AND p.kind = 'rule';
END;

-- Copies the publication into `circle.publication` in the write that
-- adopts it, and revokes the parts of the policy it replaces the day it
-- applies, whatever it is. Returns the row it made, or null for a
-- policy that marks no `publish`; a publication that is unsound, or
-- whose days meet another's it does not replace (`circle.overlap_flaw`),
-- is refused (SQLSTATE 09000).
CREATE FUNCTION circle.publication_from(ref text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  wrong text;
  made bigint;
BEGIN
  UPDATE circle.publication o SET revoked = p.applies
  FROM policy.policy p
  WHERE p.id = ref AND o.policy = p.replaces AND o.revoked IS NULL;
  IF NOT EXISTS (SELECT FROM circle.publication_of(ref)) THEN
    RETURN NULL;
  END IF;
  wrong := coalesce(
    circle.publication_flaw(circle.marks_of(ref), (SELECT p.circle FROM policy.policy p WHERE p.id = ref)),
    (SELECT circle.overlap_flaw('publication', p.applies, p.ends, p.replaces, p.id) FROM policy.policy p WHERE p.id = ref));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  INSERT INTO circle.publication (policy, parts, "from", until)
  SELECT ref, o.parts, o."from", o.until
  FROM circle.publication_of(ref) o
  RETURNING id INTO made;
  RETURN made;
END
$$;

-- Revokes the parts of a publication that ended, on the day it ended,
-- in the write that ends it.
CREATE FUNCTION circle.publication_ended(ref text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE circle.publication o SET revoked = p.ends
  FROM policy.policy p
  WHERE p.id = publication_ended.ref AND o.policy = p.id AND p.ends IS NOT NULL AND o.revoked IS NULL;
END;

-- Copies a mandate policy's values into the mandate they grant, with its
-- issuer and the mandate it is issued under, or a
-- right policy's into the right, a disclosure rule's into open books
-- (`circle.disclosure_from`) and a publication's into its parts
-- (`circle.publication_from`), in the write that adopts it, and revokes
-- the mandate or the right of the policy it replaces the day it applies,
-- with every mandate issued under that mandate (`circle.revoke`).
-- Returns the mandate, or null for a right or a policy of another kind,
-- and the mandates it revoked; values that grant nothing are refused
-- (SQLSTATE 09000).
CREATE FUNCTION circle.mandate_from(ref text) RETURNS TABLE (mandate bigint, revoked bigint[])
LANGUAGE plpgsql AS $$
DECLARE
  k text;
  marked jsonb;
  wrong text;
  made bigint;
  gone bigint[] := '{}';
BEGIN
  PERFORM circle.disclosure_from(ref);
  PERFORM circle.publication_from(ref);
  SELECT p.kind INTO k FROM policy.policy p WHERE p.id = ref AND p.kind IN ('mandate', 'right');
  IF k IS NULL THEN
    RETURN QUERY SELECT NULL::bigint, gone;
    RETURN;
  END IF;
  marked := (SELECT jsonb_object_agg(v.name, v.literal) FROM policy.value v WHERE v.policy = ref);
  wrong := CASE k WHEN 'mandate' THEN circle.mandate_flaw(marked) ELSE circle.right_flaw(marked) END;
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF k = 'mandate' THEN
    INSERT INTO circle.mandate (grantee, issuer, parent, power, policy, "limit", budget, per, procedure, scope, "from", until)
    SELECT m.grantee, p.circle, circle.parent_of(ref), m.power, ref, cella.amount(m."limit"), cella.amount(m.budget), m.per, m.procedure, m.scope, m."from", m.until
    FROM circle.mandated(ref) m
    JOIN policy.policy p ON p.id = ref
    RETURNING id INTO made;
    SELECT coalesce(circle.revoke(o.id, p.applies), '{}') INTO gone
    FROM policy.policy p
    JOIN circle.mandate o ON o.policy = p.replaces
    WHERE p.id = ref;
    gone := coalesce(gone, '{}');
  ELSE
    INSERT INTO circle.right ("right", power, policy, "limit", "from", until)
    SELECT m."right", m.power, ref, cella.amount(m."limit"), m."from", m.until
    FROM circle.mandated(ref) m;
    UPDATE circle.right o SET revoked = p.applies
    FROM policy.policy p
    WHERE p.id = ref AND o.policy = p.replaces AND o.revoked IS NULL;
  END IF;
  RETURN QUERY SELECT made, gone;
END
$$;

-- Revokes the mandate, the right, the disclosure values or the
-- publication of a policy
-- that ended, on the day it ended, in the write that ends it, and with the mandate every mandate
-- issued under it (`circle.revoke`). Returns the mandate, or null, and
-- the mandates it revoked, the policy's first.
CREATE FUNCTION circle.mandate_ended(ref text) RETURNS TABLE (mandate bigint, revoked bigint[])
LANGUAGE plpgsql AS $$
DECLARE
  made bigint;
  gone bigint[];
BEGIN
  PERFORM circle.disclosure_ended(ref);
  PERFORM circle.publication_ended(ref);
  UPDATE circle.right r SET revoked = p.ends
  FROM policy.policy p
  WHERE p.id = ref AND r.policy = p.id AND p.kind = 'right' AND p.ends IS NOT NULL AND r.revoked IS NULL;
  SELECT m.id, circle.revoke(m.id, p.ends) INTO made, gone
  FROM policy.policy p
  JOIN circle.mandate m ON m.policy = p.id
  WHERE p.id = ref AND p.kind = 'mandate' AND p.ends IS NOT NULL;
  RETURN QUERY SELECT made, coalesce(gone, '{}');
END
$$;

-- motion:policy:adopt, which the motion feat attaches it to — a mandate
-- policy the write adopted has its mandate, to the grantee, issued by
-- the circle that adopted it under the parent it holds, for the
-- power, capped and on the days its values and its policy say, and a
-- right policy its right; the mandate or the right of the policy it
-- replaces is revoked by the day it applies, and with that mandate every
-- mandate issued under it; and a policy of another kind has neither.
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
      WHERE (m.grantee, m.power, cella.cents(m."limit"), cella.cents(m.budget), m.per, m.scope, m."from", m.until)
        IS NOT DISTINCT FROM (v.grantee, v.power, v."limit", v.budget, v.per, v.scope, v."from", v.until)
    ) THEN 'mandate ' || m.id || ' is not what ' || r.id || ' marks'
    WHEN r.kind = 'mandate' AND (m.issuer <> r.circle OR m.parent IS DISTINCT FROM circle.parent_of(r.id))
      THEN 'mandate ' || m.id || ' is not issued by ' || r.circle || ', which adopted ' || r.id || ', under the mandate it holds for ' || m.power
    WHEN r.kind = 'right' AND NOT EXISTS (
      SELECT FROM circle.mandated(r.id) v
      WHERE (g."right", g.power, cella.cents(g."limit"), g."from", g.until)
        IS NOT DISTINCT FROM (v."right", v.power, v."limit", v."from", v.until)
    ) THEN 'right ' || g.id || ' is not what ' || r.id || ' marks'
    WHEN r.kind = 'rule' AND EXISTS (SELECT FROM circle.disclosure_of(r.id)) AND NOT EXISTS (
      SELECT FROM circle.disclosure_of(r.id) v
      JOIN circle.disclosure s ON s.policy = r.id
      WHERE (s.contributors, s.largest, s.two, s."from", s.until) IS NOT DISTINCT FROM (v.contributors, v.largest, v.two, v."from", v.until)
    ) THEN r.id || ' sets no disclosure values open books reads: its values are copied as it is adopted'
    WHEN EXISTS (SELECT FROM circle.disclosure s WHERE s.policy = r.id) AND NOT EXISTS (SELECT FROM circle.disclosure_of(r.id))
      THEN r.id || ' marks no disclosure value, and sets some'
    WHEN r.kind = 'rule' AND EXISTS (SELECT FROM circle.publication_of(r.id)) AND NOT EXISTS (
      SELECT FROM circle.publication_of(r.id) v
      JOIN circle.publication s ON s.policy = r.id
      WHERE (s.parts, s."from", s.until) IS NOT DISTINCT FROM (v.parts, v."from", v.until)
    ) THEN r.id || ' publishes nothing the structure''s policies read: its parts are copied as it is adopted'
    WHEN EXISTS (SELECT FROM circle.publication s WHERE s.policy = r.id) AND NOT EXISTS (SELECT FROM circle.publication_of(r.id))
      THEN r.id || ' marks no publish, and publishes some'
    WHEN EXISTS (SELECT FROM circle.mandate o WHERE o.policy = r.replaces AND (o.revoked IS NULL OR o.revoked > r.applies))
      OR EXISTS (SELECT FROM circle.right o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies)
      OR EXISTS (SELECT FROM circle.disclosure o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies)
      OR EXISTS (SELECT FROM circle.publication o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies)
      THEN 'what ' || r.replaces || ' granted is not revoked the day ' || r.id || ' applies'
    ELSE (SELECT circle.outlives(o.id, r.applies) FROM circle.mandate o WHERE o.policy = r.replaces)
  END
  FROM policy.policy r
  LEFT JOIN circle.mandate m ON m.policy = r.id
  LEFT JOIN circle.right g ON g.policy = r.id
  WHERE r.id = payload ->> 'policy';
END;

-- motion:policy:end, which the motion feat attaches it to — the mandate or
-- the right of a policy the write ended is revoked by the day it ends,
-- and with the mandate every mandate issued under it.
CREATE FUNCTION circle.revokes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    (SELECT 'mandate ' || m.id || ' of ' || r.id || ' is not revoked the day it ends'
     FROM circle.mandate m WHERE m.policy = r.id AND r.kind = 'mandate' AND (m.revoked IS NULL OR m.revoked > r.ends)),
    (SELECT circle.outlives(m.id, r.ends) FROM circle.mandate m WHERE m.policy = r.id AND r.kind = 'mandate'),
    (SELECT 'right ' || g.id || ' of ' || r.id || ' is not revoked the day it ends'
     FROM circle.right g WHERE g.policy = r.id AND r.kind = 'right' AND g.revoked IS DISTINCT FROM r.ends),
    (SELECT 'the disclosure values of ' || r.id || ' are not revoked the day it ends'
     FROM circle.disclosure s WHERE s.policy = r.id AND s.revoked IS DISTINCT FROM r.ends),
    (SELECT 'the publication of ' || r.id || ' is not revoked the day it ends'
     FROM circle.publication s WHERE s.policy = r.id AND s.revoked IS DISTINCT FROM r.ends)
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

-- Why the assembly would not keep a collective `adopt-policy` mandate
-- in force on the verdict date with no `until` once the policies
-- `ending` end and the mandate policies `adopting` are adopted, or null
-- when it would: it keeps one it holds, never revoked, whose `from` is on
-- or before the verdict date and whose policy is none of `ending`, or one
-- of `adopting`, each the values its policy marks and its `from` and
-- `until`, if any, granting it with no `until` and no `from` after the
-- verdict date. One that applies only from a later day keeps nothing
-- until then, so a replacement leaves no day without one. Through it the
-- assembly grants itself again any power it ended. The reason names the
-- last such mandate in force it holds, the one the write or the motion
-- ends.
CREATE FUNCTION circle.sovereignty(ending text[], adopting jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.assembly() || ' would lose its power to adopt policies: '
    || coalesce('mandate ' || l.id || ' of ' || l.policy || ' is its last collective adopt-policy mandate in force with no until',
         'it holds no collective adopt-policy mandate in force with no until')
    || '; adopting another with no from and no until in its place, in the same motion and before ending it, keeps it'
  FROM (SELECT) x
  LEFT JOIN LATERAL (
    SELECT m.id, m.policy FROM circle.mandate m
    WHERE m.grantee = circle.assembly() AND m.power = 'adopt-policy' AND m.until IS NULL
      AND (m."from" IS NULL OR m."from" <= cella.verdict_date())
    ORDER BY m.policy = ANY (coalesce(sovereignty.ending, '{}')) DESC, m.revoked DESC NULLS FIRST, m.id DESC
    LIMIT 1
  ) l ON true
  WHERE NOT EXISTS (
      SELECT FROM circle.mandate m
      WHERE m.grantee = circle.assembly() AND m.power = 'adopt-policy'
        AND m.until IS NULL AND m.revoked IS NULL
        AND (m."from" IS NULL OR m."from" <= cella.verdict_date())
        AND m.policy <> ALL (coalesce(sovereignty.ending, '{}'))
    )
    AND NOT EXISTS (
      SELECT FROM jsonb_array_elements(coalesce(sovereignty.adopting, '[]')) a
      WHERE a ->> 'circle' = circle.assembly() AND a ->> 'power' = 'adopt-policy'
        AND nullif(a ->> 'until', '') IS NULL
        AND (nullif(a ->> 'from', '') IS NULL OR (a ->> 'from')::date <= cella.verdict_date())
    );
END;

-- Whether the policy `ref` grants the assembly a collective
-- `adopt-policy` mandate with no `until` that stands on the verdict
-- date, revoked by no earlier day: one whose end or replacement
-- `circle.sovereignty` judges.
CREATE FUNCTION circle.sovereign_by(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle.mandate m
    WHERE m.policy = sovereign_by.ref
      AND m.grantee = circle.assembly() AND m.power = 'adopt-policy' AND m.until IS NULL
      AND (m.revoked IS NULL OR m.revoked >= cella.verdict_date())
  );
END;

-- motion:policy:adopt and motion:policy:end, which the motion feat
-- attaches it to — a write that ends, or adopts a policy replacing, one
-- that grants the assembly a collective `adopt-policy` mandate with no
-- `until` (`circle.sovereign_by`) leaves it still keeping one
-- (`circle.sovereignty`).
CREATE FUNCTION circle.sovereign(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.sovereignty('{}', '[]')
  FROM policy.policy p
  WHERE p.id = payload ->> 'policy'
    AND (circle.sovereign_by(p.id) OR circle.sovereign_by(p.replaces));
END;
