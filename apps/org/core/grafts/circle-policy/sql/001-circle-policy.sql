-- circle-policy, core's graft joining the circles to the policy register:
-- a mandate, a right, open books' disclosure values, the publication and
-- the co-op's particulars are each a policy's, a sentence a circle adopted by motion. Their
-- values are read here from the register, by its values, never its
-- wording, and issued by the circles' writes as the policy is adopted
-- (`circle.issue`, `circle.give`, `circle.disclose`, `circle.publish`,
-- `circle.particularise`),
-- and revoked as it ends or is replaced (`circle.withdraw`), in the same
-- write. Neither feat knows the other; this schema holds what reads both.

CREATE SCHEMA circle_policy;

-- What is wrong with a mandate's values, by name as written (`{"role":
-- "finance", "power": "pay-supplier", "limit": "3 000 €"}`), or null: it
-- marks one grantee, a role this feat has or a circle it has, never a
-- person nor a right, a power in lower case, at most a limit or a budget,
-- each an amount, a budget with its period, perhaps a procedure by name,
-- perhaps a scope, a circle it has or `own`, and nothing else.
CREATE FUNCTION circle_policy.mandate_flaw(marked jsonb) RETURNS text
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
CREATE FUNCTION circle_policy.right_flaw(marked jsonb) RETURNS text
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
CREATE FUNCTION circle_policy.mandated(ref text) RETURNS TABLE (
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

-- The mandate a mandate policy is issued under, or null: its values'
-- parent (`circle.parent_for`), issued by the circle that adopted it from
-- the day it applies, besides itself and the policy it replaces.
CREATE FUNCTION circle_policy.parent_of(ref text) RETURNS bigint
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.parent_for(p.circle, v.power, cella.amount(v."limit"), cella.amount(v.budget), v.per, v.scope, p.applies, v.until, ARRAY[p.id, p.replaces])
  FROM policy.policy p
  CROSS JOIN circle_policy.mandated(parent_of.ref) v
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
CREATE FUNCTION circle_policy.disclosure_flaw(marks jsonb, issuer text) RETURNS text
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

-- A policy's marks as `circle_policy.disclosure_flaw` reads them, from the
-- register.
CREATE FUNCTION circle_policy.marks_of(ref text) RETURNS jsonb
LANGUAGE sql STABLE
RETURN (SELECT jsonb_object_agg(v.name, jsonb_build_object('literal', v.literal, 'stricter', v.stricter))
        FROM policy.value v WHERE v.policy = ref);

-- A disclosure rule's values as the register types them, and its days;
-- no row for a policy that marks none of them.
CREATE FUNCTION circle_policy.disclosure_of(ref text) RETURNS TABLE (contributors integer, largest numeric, two numeric, "from" date, until date)
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

-- Copies open books' disclosure rule into `circle.disclosure` in the
-- write that adopts it (`circle.disclose`). Returns the row it made, or
-- null for a policy that marks no disclosure value; a rule whose values
-- are unsound, or whose days meet another's it does not replace
-- (`circle.overlap_flaw`), is refused (SQLSTATE 09000).
CREATE FUNCTION circle_policy.disclosure_from(ref text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  wrong text;
  made bigint;
BEGIN
  IF NOT EXISTS (SELECT FROM policy.policy p WHERE p.id = ref AND p.kind = 'rule')
    OR NOT EXISTS (SELECT FROM policy.value v WHERE v.policy = ref AND v.name LIKE 'disclosure\_%') THEN
    RETURN NULL;
  END IF;
  wrong := coalesce(
    circle_policy.disclosure_flaw(circle_policy.marks_of(ref), (SELECT p.circle FROM policy.policy p WHERE p.id = ref)),
    (SELECT circle.overlap_flaw('disclosure', p.applies, p.ends, p.replaces, p.id) FROM policy.policy p WHERE p.id = ref));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT circle.disclose(ref, d.contributors, d.largest, d.two, d."from", d.until) INTO made
  FROM circle_policy.disclosure_of(ref) d;
  RETURN made;
END
$$;

-- The publication's parts as its rule names them, and its days; no row
-- for a policy that marks no `publish`.
CREATE FUNCTION circle_policy.publication_of(ref text) RETURNS TABLE (parts text[], "from" date, until date)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.parts(v.literal), p.applies, p.ends
  FROM policy.policy p
  JOIN policy.value v ON v.policy = p.id AND v.name = 'publish'
  WHERE p.id = publication_of.ref AND p.kind = 'rule';
END;

-- Copies the publication into `circle.publication` in the write that
-- adopts it (`circle.publish`). Returns the row it made, or null for a
-- policy that marks no `publish`; a publication that is unsound, or
-- whose days meet another's it does not replace (`circle.overlap_flaw`),
-- is refused (SQLSTATE 09000).
CREATE FUNCTION circle_policy.publication_from(ref text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  wrong text;
  made bigint;
BEGIN
  IF NOT EXISTS (SELECT FROM circle_policy.publication_of(ref)) THEN
    RETURN NULL;
  END IF;
  wrong := coalesce(
    circle.publication_flaw(circle_policy.marks_of(ref), (SELECT p.circle FROM policy.policy p WHERE p.id = ref)),
    (SELECT circle.overlap_flaw('publication', p.applies, p.ends, p.replaces, p.id) FROM policy.policy p WHERE p.id = ref));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT circle.publish(ref, o.parts, o."from", o.until) INTO made
  FROM circle_policy.publication_of(ref) o;
  RETURN made;
END
$$;

-- The particulars as their rule marks them, each as written, and its
-- days; no row for a policy that marks none of them.
CREATE FUNCTION circle_policy.particulars_of(ref text) RETURNS TABLE (name text, legal_name text, form text, capital text, siren text,
                                                                     rcs text, vat text, seat text, "from" date, until date)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT max(v.literal) FILTER (WHERE v.name = 'particulars_name'),
         max(v.literal) FILTER (WHERE v.name = 'particulars_legal_name'),
         max(v.literal) FILTER (WHERE v.name = 'particulars_form'),
         max(v.literal) FILTER (WHERE v.name = 'particulars_capital'),
         max(v.literal) FILTER (WHERE v.name = 'particulars_siren'),
         max(v.literal) FILTER (WHERE v.name = 'particulars_rcs'),
         max(v.literal) FILTER (WHERE v.name = 'particulars_vat'),
         max(v.literal) FILTER (WHERE v.name = 'particulars_seat'),
         p.applies, p.ends
  FROM policy.policy p
  JOIN policy.value v ON v.policy = p.id
  WHERE p.id = particulars_of.ref AND p.kind = 'rule'
  GROUP BY p.id, p.applies, p.ends
  HAVING bool_or(v.name = ANY (circle.particular_names()));
END;

-- Copies the co-op's particulars into `circle.particulars` in the write
-- that adopts their rule (`circle.particularise`). Returns the row it
-- made, or null for a policy that marks none of them; particulars that
-- are unsound, or whose days meet another's they do not replace
-- (`circle.overlap_flaw`), are refused (SQLSTATE 09000).
CREATE FUNCTION circle_policy.particulars_from(ref text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  wrong text;
  made bigint;
BEGIN
  IF NOT EXISTS (SELECT FROM circle_policy.particulars_of(ref)) THEN
    RETURN NULL;
  END IF;
  wrong := coalesce(
    circle.particulars_flaw(circle_policy.marks_of(ref), (SELECT p.circle FROM policy.policy p WHERE p.id = ref)),
    (SELECT circle.overlap_flaw('particulars', p.applies, p.ends, p.replaces, p.id) FROM policy.policy p WHERE p.id = ref));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT circle.particularise(ref, o.name, o.legal_name, o.form, o.capital, o.siren, o.rcs, o.vat, o.seat, o."from", o.until) INTO made
  FROM circle_policy.particulars_of(ref) o;
  RETURN made;
END
$$;

-- What is wrong with a setting rule, by its values as written
-- (`{"setting": "reactions", "value": "off"}`), adopted by `issuer`
-- from `day`, perhaps until `until`, replacing `replaces`, or null:
-- null too for a rule marking no `setting`. It marks a setting a slice
-- registered, its value, `on` or `off`, perhaps the circle it is for,
-- which only the assembly names other than itself, and nothing else; and
-- one rule sets a setting for a circle at a time
-- (`circle.setting_overlap`). `made` is the rule itself, once adopted.
CREATE FUNCTION circle_policy.setting_flaw(marked jsonb, issuer text, day date, until date, replaces text, made text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT coalesce(marked, '{}') ? 'setting' THEN NULL
    WHEN x.other IS NOT NULL THEN 'a setting rule marks its setting, its value and perhaps its circle, not ' || x.other
    WHEN NOT EXISTS (SELECT FROM circle.setting s WHERE s.name = v.setting)
      THEN 'no setting ' || v.setting || ': a rule sets one a slice offers, as {setting: reactions}'
    WHEN v.value IS NULL OR v.value NOT IN ('on', 'off')
      THEN 'a setting is on or off, as {value: off}, not ' || coalesce(marked ->> 'value', 'unmarked')
    WHEN NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = v.circle) THEN 'no circle ' || v.circle
    WHEN v.circle <> setting_flaw.issuer AND setting_flaw.issuer IS DISTINCT FROM circle.assembly()
      THEN setting_flaw.issuer || ' sets its own settings, not ' || v.circle || '''s: only the assembly sets another circle''s'
    ELSE circle.setting_overlap(v.circle, v.setting, setting_flaw.day, setting_flaw.until, setting_flaw.replaces, setting_flaw.made)
  END
  FROM (
    SELECT btrim(marked ->> 'setting') AS setting, lower(btrim(marked ->> 'value')) AS value,
           coalesce(btrim(marked ->> 'circle'), setting_flaw.issuer) AS circle
  ) v,
  LATERAL (
    SELECT (SELECT k FROM jsonb_object_keys(coalesce(marked, '{}')) k
            WHERE k NOT IN ('setting', 'value', 'circle') ORDER BY k LIMIT 1) AS other
  ) x;
END;

-- A setting rule's values as it marks them, the circle it is for, the
-- one adopting it where it names none, and its days; no row for a policy
-- that marks no `setting`.
CREATE FUNCTION circle_policy.setting_marked(ref text) RETURNS TABLE (setting text, value text, circle text, "from" date, until date)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT max(btrim(v.literal)) FILTER (WHERE v.name = 'setting'),
         max(lower(btrim(v.literal))) FILTER (WHERE v.name = 'value'),
         coalesce(max(btrim(v.literal)) FILTER (WHERE v.name = 'circle'), p.circle),
         p.applies, p.ends
  FROM policy.policy p
  JOIN policy.value v ON v.policy = p.id
  WHERE p.id = setting_marked.ref AND p.kind = 'rule'
  GROUP BY p.id, p.circle, p.applies, p.ends
  HAVING bool_or(v.name = 'setting');
END;

-- Copies a setting rule into `circle.setting_value` in the write that
-- adopts it (`circle.set_setting`). Returns the row it made, or null for
-- a policy that marks no `setting`; a rule whose values are unsound, or
-- whose days meet another's for the same setting and circle it does not
-- replace, is refused (SQLSTATE 09000).
CREATE FUNCTION circle_policy.setting_from(ref text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  wrong text;
  made bigint;
BEGIN
  IF NOT EXISTS (SELECT FROM circle_policy.setting_marked(ref)) THEN
    RETURN NULL;
  END IF;
  SELECT circle_policy.setting_flaw((SELECT jsonb_object_agg(v.name, v.literal) FROM policy.value v WHERE v.policy = ref),
                                    p.circle, p.applies, p.ends, p.replaces, p.id) INTO wrong
  FROM policy.policy p WHERE p.id = ref;
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT circle.set_setting(ref, o.circle, o.setting, o.value, o."from", o.until) INTO made
  FROM circle_policy.setting_marked(ref) o;
  RETURN made;
END
$$;

-- Revokes what the policy it replaces granted, the day it applies,
-- whatever it is (`circle.withdraw`), with every mandate issued under
-- that one's mandate; then copies a mandate policy's values into the
-- mandate they grant, with its issuer and the mandate it is issued under
-- (`circle.issue`), or a right policy's into the right (`circle.give`),
-- a disclosure rule's into open books (`circle_policy.disclosure_from`), a
-- publication's into its parts (`circle_policy.publication_from`), the
-- particulars' into theirs (`circle_policy.particulars_from`) and a
-- setting rule's into the circle's value (`circle_policy.setting_from`),
-- in the write
-- that adopts it. Returns the mandate, or null for a right or a policy of
-- another kind, and the mandates it revoked; values that grant nothing
-- are refused (SQLSTATE 09000).
CREATE FUNCTION circle_policy.mandate_from(ref text) RETURNS TABLE (mandate bigint, revoked bigint[])
LANGUAGE plpgsql AS $$
DECLARE
  k text;
  marked jsonb;
  wrong text;
  made bigint;
  gone bigint[] := '{}';
BEGIN
  SELECT w.revoked INTO gone
  FROM policy.policy p
  CROSS JOIN LATERAL circle.withdraw(p.replaces, p.applies) w
  WHERE p.id = ref AND p.replaces IS NOT NULL;
  gone := coalesce(gone, '{}');
  PERFORM circle_policy.disclosure_from(ref);
  PERFORM circle_policy.publication_from(ref);
  PERFORM circle_policy.particulars_from(ref);
  PERFORM circle_policy.setting_from(ref);
  SELECT p.kind INTO k FROM policy.policy p WHERE p.id = ref AND p.kind IN ('mandate', 'right');
  IF k IS NULL THEN
    RETURN QUERY SELECT NULL::bigint, gone;
    RETURN;
  END IF;
  marked := (SELECT jsonb_object_agg(v.name, v.literal) FROM policy.value v WHERE v.policy = ref);
  wrong := CASE k WHEN 'mandate' THEN circle_policy.mandate_flaw(marked) ELSE circle_policy.right_flaw(marked) END;
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF k = 'mandate' THEN
    SELECT circle.issue(ref, m.grantee, p.circle, circle_policy.parent_of(ref), m.power, cella.amount(m."limit"), cella.amount(m.budget),
                        m.per, m.procedure, m.scope, m."from", m.until) INTO made
    FROM circle_policy.mandated(ref) m
    JOIN policy.policy p ON p.id = ref;
  ELSE
    PERFORM circle.give(ref, m."right", m.power, cella.amount(m."limit"), m."from", m.until)
    FROM circle_policy.mandated(ref) m;
  END IF;
  RETURN QUERY SELECT made, gone;
END
$$;

-- Revokes the mandate, the right, the disclosure values, the
-- publication or the particulars of a policy that ended, on the day it ended, in the write
-- that ends it, and with the mandate every mandate issued under it
-- (`circle.withdraw`). Returns the mandate, or null, and the mandates it
-- revoked, the policy's first.
CREATE FUNCTION circle_policy.mandate_ended(ref text) RETURNS TABLE (mandate bigint, revoked bigint[])
LANGUAGE plpgsql AS $$
DECLARE
  made bigint;
  gone bigint[];
BEGIN
  SELECT w.mandate, w.revoked INTO made, gone
  FROM policy.policy p
  CROSS JOIN LATERAL circle.withdraw(p.id, p.ends) w
  WHERE p.id = ref AND p.ends IS NOT NULL;
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
CREATE FUNCTION circle_policy.grants(payload jsonb) RETURNS text
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
      SELECT FROM circle_policy.mandated(r.id) v
      WHERE (m.grantee, m.power, cella.cents(m."limit"), cella.cents(m.budget), m.per, m.scope, m."from", m.until)
        IS NOT DISTINCT FROM (v.grantee, v.power, v."limit", v.budget, v.per, v.scope, v."from", v.until)
    ) THEN 'mandate ' || m.id || ' is not what ' || r.id || ' marks'
    WHEN r.kind = 'mandate' AND (m.issuer <> r.circle OR m.parent IS DISTINCT FROM circle_policy.parent_of(r.id))
      THEN 'mandate ' || m.id || ' is not issued by ' || r.circle || ', which adopted ' || r.id || ', under the mandate it holds for ' || m.power
    WHEN r.kind = 'right' AND NOT EXISTS (
      SELECT FROM circle_policy.mandated(r.id) v
      WHERE (g."right", g.power, cella.cents(g."limit"), g."from", g.until)
        IS NOT DISTINCT FROM (v."right", v.power, v."limit", v."from", v.until)
    ) THEN 'right ' || g.id || ' is not what ' || r.id || ' marks'
    WHEN r.kind = 'rule' AND EXISTS (SELECT FROM circle_policy.disclosure_of(r.id)) AND NOT EXISTS (
      SELECT FROM circle_policy.disclosure_of(r.id) v
      JOIN circle.disclosure s ON s.policy = r.id
      WHERE (s.contributors, s.largest, s.two, s."from", s.until) IS NOT DISTINCT FROM (v.contributors, v.largest, v.two, v."from", v.until)
    ) THEN r.id || ' sets no disclosure values open books reads: its values are copied as it is adopted'
    WHEN EXISTS (SELECT FROM circle.disclosure s WHERE s.policy = r.id) AND NOT EXISTS (SELECT FROM circle_policy.disclosure_of(r.id))
      THEN r.id || ' marks no disclosure value, and sets some'
    WHEN r.kind = 'rule' AND EXISTS (SELECT FROM circle_policy.publication_of(r.id)) AND NOT EXISTS (
      SELECT FROM circle_policy.publication_of(r.id) v
      JOIN circle.publication s ON s.policy = r.id
      WHERE (s.parts, s."from", s.until) IS NOT DISTINCT FROM (v.parts, v."from", v.until)
    ) THEN r.id || ' publishes nothing the structure''s policies read: its parts are copied as it is adopted'
    WHEN EXISTS (SELECT FROM circle.publication s WHERE s.policy = r.id) AND NOT EXISTS (SELECT FROM circle_policy.publication_of(r.id))
      THEN r.id || ' marks no publish, and publishes some'
    WHEN r.kind = 'rule' AND EXISTS (SELECT FROM circle_policy.particulars_of(r.id)) AND NOT EXISTS (
      SELECT FROM circle_policy.particulars_of(r.id) v
      JOIN circle.particulars s ON s.policy = r.id
      WHERE (s.name, s.legal_name, s.form, s.capital, s.siren, s.rcs, s.vat, s.seat, s."from", s.until)
        IS NOT DISTINCT FROM (v.name, v.legal_name, v.form, v.capital, v.siren, v.rcs, v.vat, v.seat, v."from", v.until)
    ) THEN r.id || ' sets no particulars the co-op''s papers read: its values are copied as it is adopted'
    WHEN EXISTS (SELECT FROM circle.particulars s WHERE s.policy = r.id) AND NOT EXISTS (SELECT FROM circle_policy.particulars_of(r.id))
      THEN r.id || ' marks no particulars, and sets some'
    WHEN r.kind = 'rule' AND EXISTS (SELECT FROM circle_policy.setting_marked(r.id)) AND NOT EXISTS (
      SELECT FROM circle_policy.setting_marked(r.id) v
      JOIN circle.setting_value s ON s.policy = r.id
      WHERE (s.circle, s.setting, s.value, s."from", s.until) IS NOT DISTINCT FROM (v.circle, v.setting, v.value, v."from", v.until)
    ) THEN r.id || ' sets no setting a circle reads: its value is copied as it is adopted'
    WHEN EXISTS (SELECT FROM circle.setting_value s WHERE s.policy = r.id) AND NOT EXISTS (SELECT FROM circle_policy.setting_marked(r.id))
      THEN r.id || ' marks no setting, and sets one'
    WHEN EXISTS (SELECT FROM circle.mandate o WHERE o.policy = r.replaces AND (o.revoked IS NULL OR o.revoked > r.applies))
      OR EXISTS (SELECT FROM circle.right o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies)
      OR EXISTS (SELECT FROM circle.disclosure o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies)
      OR EXISTS (SELECT FROM circle.publication o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies)
      OR EXISTS (SELECT FROM circle.particulars o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies)
      OR EXISTS (SELECT FROM circle.setting_value o WHERE o.policy = r.replaces AND o.revoked IS DISTINCT FROM r.applies)
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
CREATE FUNCTION circle_policy.revokes(payload jsonb) RETURNS text
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
     FROM circle.publication s WHERE s.policy = r.id AND s.revoked IS DISTINCT FROM r.ends),
    (SELECT 'the particulars of ' || r.id || ' are not revoked the day it ends'
     FROM circle.particulars s WHERE s.policy = r.id AND s.revoked IS DISTINCT FROM r.ends),
    (SELECT 'the setting value of ' || r.id || ' is not revoked the day it ends'
     FROM circle.setting_value s WHERE s.policy = r.id AND s.revoked IS DISTINCT FROM r.ends)
  )
  FROM policy.policy r
  WHERE r.id = payload ->> 'policy';
END;

-- motion:policy:adopt and motion:policy:end, which the motion feat
-- attaches it to — a write that ends, or adopts a policy replacing, one
-- that grants the assembly a collective `adopt-policy` mandate with no
-- `until` (`circle.sovereign_by`) leaves it still keeping one
-- (`circle.sovereignty`).
CREATE FUNCTION circle_policy.sovereign(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.sovereignty('{}', '[]')
  FROM policy.policy p
  WHERE p.id = payload ->> 'policy'
    AND (circle.sovereign_by(p.id) OR circle.sovereign_by(p.replaces));
END;
GRANT USAGE ON SCHEMA circle_policy TO cella_app, cella_guards;
