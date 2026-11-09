-- What a motion decides of the circles' powers: a mandate is a policy,
-- adopted and ended by the motion feat's own kinds, `policy` and `end`,
-- which this feat extends with core's copy. No motion places
-- a circle: circles never nest.

-- Which circle an action is about: for a mandate policy, the circle of
-- the role it marks, or the circle it marks for a collective mandate;
-- for the end of a policy that granted a mandate, the circle of the
-- mandate's role, or the circle that is its grantee. A role every working
-- circle has (`*`) is the assembly's to grant, and so is a right, which
-- reaches every circle: neither names one.
CREATE VIEW motion.circle_action WITH (security_invoker = true) AS
SELECT m.motion, m.n, m.kind, m.args,
       CASE m.kind
         WHEN 'policy' THEN coalesce(
           motion.marked(m.args ->> 'wording') ->> 'circle',
           (SELECT nullif(r.circle, '*') FROM circle.role r WHERE r.id = motion.marked(m.args ->> 'wording') ->> 'role')
         )
         WHEN 'end' THEN (
           SELECT coalesce(c.id, nullif(r.circle, '*'))
           FROM circle.mandate x
           LEFT JOIN circle.circle c ON c.id = x.grantee
           LEFT JOIN circle.role r ON r.id = x.grantee
           WHERE x.policy = m.args ->> 'policy'
         )
       END AS circle
FROM motion.action m
WHERE (m.kind = 'policy' AND m.args ->> 'kind' IN ('mandate', 'right'))
  OR (m.kind = 'end' AND EXISTS (SELECT FROM circle.mandate x WHERE x.policy = m.args ->> 'policy'))
  OR (m.kind = 'end' AND EXISTS (SELECT FROM circle.right x WHERE x.policy = m.args ->> 'policy'));

-- Whether a motion of the circle `decider` may decide about the circle
-- `subject`, never by where either sits, since circles never nest: the
-- assembly decides about every circle, and any other circle about every
-- circle but itself and the assembly. A circle does not decide its own
-- seats or powers; another does. With no circle named (`*`), the
-- assembly alone.
CREATE FUNCTION motion.decides(decider text, subject text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT decides.decider = circle.assembly()
    OR (decides.decider IS DISTINCT FROM decides.subject
      AND decides.subject IS DISTINCT FROM circle.assembly()
      AND EXISTS (SELECT FROM circle.circle c WHERE c.id = decides.subject)
      AND EXISTS (SELECT FROM circle.circle c WHERE c.id = decides.decider));
END;

-- The circle a proposal about `subject` is put to: a circle other than
-- the assembly that may decide about it and holds, on `day`, a collective
-- mandate for every power in `powers`, the first by id; or else the
-- assembly, which holds every power inherently. For a grant, `grant`
-- carries its values, its power, its limit and budget in cents, its
-- period and its scope, and the days it applies from and until, and the
-- circle also holds a collective mandate for its power, standing on the
-- day the grant applies from, or else `day`, that a mandate of those
-- values over those days, until its until or none, is no wider than
-- (`circle.wider`), the one it issues the grant under: the days
-- `motion.grant_flaw` judges the grant on, so neither it nor
-- `circle.narrows` refuses the grant for its issuer.
CREATE FUNCTION motion.decider(subject text, powers text[], day date, "grant" jsonb DEFAULT NULL) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    (SELECT c.id FROM circle.circle c
     WHERE NOT c.assembly
       AND motion.decides(c.id, coalesce(decider.subject, '*'))
       AND NOT EXISTS (SELECT FROM unnest(decider.powers) w(power) WHERE NOT circle.holds(c.id, w.power, decider.day))
       AND (decider."grant" IS NULL OR EXISTS (
         SELECT FROM circle.mandate u
         JOIN circle.grantee g ON g.id = u.grantee AND g.kind = 'circle'
         CROSS JOIN LATERAL (
           SELECT coalesce((decider."grant" ->> 'from')::date, decider.day) AS "from", (decider."grant" ->> 'until')::date AS until
         ) t
         WHERE u.grantee = c.id
           AND u.power = decider."grant" ->> 'power'
           AND (u."from" IS NULL OR u."from" <= t."from")
           AND (u.until IS NULL OR u.until > t."from")
           AND (u.revoked IS NULL OR u.revoked > t."from")
           AND circle.wider(
             decider."grant" ->> 'power',
             ((decider."grant" ->> 'limit')::bigint)::cella.amount,
             ((decider."grant" ->> 'budget')::bigint)::cella.amount,
             decider."grant" ->> 'per',
             decider."grant" ->> 'scope',
             t."from",
             t.until,
             u.id
           ) IS NULL))
     ORDER BY c.id
     LIMIT 1),
    circle.assembly()
  );
END;

-- A mandate policy's values as `circle.parent_for` reads them, from its
-- wording's marks: its grantee and the circle it is about, as
-- `motion.circle_action` names it, its power, its limit and budget,
-- each where it is an amount, its period and its scope.
CREATE FUNCTION motion.granting(wording text) RETURNS TABLE (
  grantee text, subject text, power text, "limit" cella.amount, budget cella.amount, per text, scope text
)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(k.marked ->> 'role', k.marked ->> 'circle'),
         coalesce(k.marked ->> 'circle', (SELECT nullif(r.circle, '*') FROM circle.role r WHERE r.id = k.marked ->> 'role')),
         k.marked ->> 'power',
         (SELECT (t.value #>> '{}')::bigint::cella.amount FROM policy.typed('limit', k.marked ->> 'limit') t WHERE t.type = 'amount'),
         (SELECT (t.value #>> '{}')::bigint::cella.amount FROM policy.typed('budget', k.marked ->> 'budget') t WHERE t.type = 'amount'),
         k.marked ->> 'per',
         btrim(k.marked ->> 'scope')
  FROM (SELECT coalesce(motion.marked(granting.wording), '{}') AS marked) k;
END;

-- What is wrong with a mandate policy of this wording that a motion of
-- `issuer` would adopt, applying from `from` until `until`, as the field
-- a form names it under and why, or no row: its values are unsound
-- (`circle_policy.mandate_flaw`); the issuer may not decide about its grantee's
-- circle (`motion.decides`); or the issuer, not the assembly, holds no
-- mandate for its power standing that day to issue it under, or none it
-- is no wider than (`circle.parent_for`, `circle.wider`), the same SQL
-- that finds its parent as it is adopted. Each reason says what would fix
-- it, and names no one.
CREATE FUNCTION motion.grant_flaw(issuer text, wording text, "from" date, until date) RETURNS TABLE (field text, reason text)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT f.field, f.reason
  FROM (
    SELECT CASE
             WHEN x.flaw LIKE 'a mandate names its power%' THEN 'power'
             WHEN x.flaw LIKE 'a limit %' OR x.flaw LIKE 'a mandate caps %' THEN 'limit'
             WHEN x.flaw LIKE 'a budget %' THEN 'budget'
             WHEN x.flaw LIKE 'a mandate''s scope %' THEN 'scope'
             WHEN x.flaw LIKE 'a mandate names its procedure %' THEN 'procedure'
             ELSE 'grantee'
           END AS field,
           x.flaw AS reason, 1 AS rank
    FROM (SELECT circle_policy.mandate_flaw(motion.marked(grant_flaw.wording)) AS flaw) x
    WHERE x.flaw IS NOT NULL
    UNION ALL
    SELECT 'issuer', coalesce(grant_flaw.issuer, 'no circle') || ' may not decide to grant a mandate in '
             || coalesce(v.subject, 'every working circle') || ': put it to ' || circle.assembly() || ', which decides about every circle', 2
    FROM motion.granting(grant_flaw.wording) v
    WHERE NOT coalesce(motion.decides(grant_flaw.issuer, coalesce(v.subject, '*')), false)
    UNION ALL
    SELECT CASE
             WHEN p.id IS NULL THEN 'issuer'
             WHEN w.wider LIKE 'its cap%' THEN CASE WHEN v.budget IS NOT NULL THEN 'budget' ELSE 'limit' END
             WHEN w.wider LIKE 'it covers%' THEN 'scope'
             WHEN w.wider LIKE 'it applies from%' THEN 'from'
             WHEN w.wider LIKE 'it outlasts%' THEN 'until'
             ELSE 'power'
           END,
           CASE
             WHEN p.id IS NULL
               THEN grant_flaw.issuer || ' holds no mandate for ' || v.power || ' standing on ' || grant_flaw."from"
                 || ' to issue it under: put it to ' || circle.assembly() || ', or have ' || circle.assembly()
                 || ' grant ' || grant_flaw.issuer || ' one first'
             ELSE 'it is wider than mandate ' || p.id || ', the ' || v.power || ' ' || grant_flaw.issuer
               || ' holds to issue it under: ' || w.wider || '; narrow it to fit, or put it to ' || circle.assembly()
           END,
           3
    FROM motion.granting(grant_flaw.wording) v
    CROSS JOIN LATERAL (
      SELECT circle.parent_for(grant_flaw.issuer, v.power, v."limit", v.budget, v.per, v.scope, grant_flaw."from", grant_flaw.until) AS id
    ) p
    CROSS JOIN LATERAL (
      SELECT circle.wider(v.power, v."limit", v.budget, v.per, v.scope, grant_flaw."from", grant_flaw.until, p.id) AS wider
    ) w
    WHERE grant_flaw.issuer IS DISTINCT FROM circle.assembly()
      AND (p.id IS NULL OR w.wider IS NOT NULL)
  ) f
  ORDER BY f.rank
  LIMIT 1;
END;

-- The mandates the settled entry that carried out a motion's action `n`
-- revoked, as its `revoked` says, the adoption of a policy replacing a
-- mandate's or the end of one; none where no such entry settled. The log's
-- form is its owner's, so it reads as its owner, and answers with those
-- ids alone, which name no one.
CREATE FUNCTION motion.revoked_by(motion text, n integer) RETURNS bigint[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT coalesce(array_agg(w::bigint), '{}')
  FROM cella.log l
  CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(l.form -> 'revoked', '[]')) w
  WHERE l.settled AND l.op IN ('motion:policy:adopt', 'motion:policy:end')
    AND l.form ->> 'motion' = revoked_by.motion AND l.form ->> 'n' = revoked_by.n::text;
END;

-- What each action of a motion does to the mandates: for a mandate
-- policy, the mandate it granted once the motion is closed and the parent
-- it was issued under, or while it is open the parent it would be issued
-- under were it closed at its deadline (`circle.parent_for`) and what
-- `motion.grant_flaw` finds wrong with it; for the end or the replacement
-- of a mandate's policy, that mandate and every mandate below it its
-- close revokes (`circle.under`), those standing on the day it ends while
-- open, and once closed those its close revoked, as the `revoked` of the
-- entry that carried the action out says (`motion.revoked_by`), never
-- one another write revoked the same day.
CREATE FUNCTION motion.issues(motion text) RETURNS TABLE (n integer, kind text, closed boolean, granted bigint, parent bigint, flaw text, ends bigint, revokes bigint[])
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT m.n, m.kind, d.closed IS NOT NULL, g.id,
         CASE WHEN d.closed IS NULL AND m.kind = 'policy'
           THEN circle.parent_for(d.circle, v.power, v."limit", v.budget, v.per, v.scope, t.day, t.until, ARRAY[nullif(m.args ->> 'replaces', '')])
           ELSE g.parent END,
         CASE WHEN d.closed IS NULL AND m.kind = 'policy'
           THEN (SELECT f.reason FROM motion.grant_flaw(d.circle, m.args ->> 'wording', t.day, t.until) f) END,
         x.id,
         CASE WHEN x.id IS NULL THEN NULL ELSE ARRAY(
           SELECT u.id FROM circle.under(x.id) u JOIN circle.mandate o ON o.id = u.id
           WHERE CASE WHEN d.closed IS NULL
                   THEN (o.revoked IS NULL OR o.revoked > t.day) AND (o.until IS NULL OR o.until > t.day)
                   ELSE u.id = ANY (motion.revoked_by(m.motion, m.n)) END
           ORDER BY u.depth, u.id) END
  FROM motion.action m
  JOIN motion.motion d ON d.id = m.motion
  CROSS JOIN LATERAL (
    SELECT CASE WHEN coalesce(m.args ->> 'from', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (m.args ->> 'from')::date ELSE d.deadline END AS day,
           CASE WHEN coalesce(m.args ->> 'until', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (m.args ->> 'until')::date END AS until
  ) t
  LEFT JOIN LATERAL motion.granting(m.args ->> 'wording') v ON m.kind = 'policy'
  LEFT JOIN policy.policy r ON m.kind = 'policy' AND r.motion = m.motion AND r.n = m.n
  LEFT JOIN circle.mandate g ON g.policy = r.id
  LEFT JOIN circle.mandate x ON x.policy = CASE m.kind WHEN 'end' THEN m.args ->> 'policy' ELSE nullif(m.args ->> 'replaces', '') END
  WHERE m.motion = issues.motion
    AND ((m.kind = 'policy' AND m.args ->> 'kind' = 'mandate') OR x.id IS NOT NULL)
  ORDER BY m.n;
END;

-- What is wrong with withholding open books, put on `circle`'s page and
-- naming `policy`, on `day`, or null: a withholding ends the disclosure
-- rule in force that day and nothing else, and is the assembly's, so it
-- is put on the assembly's page, where a rule stands, naming that rule.
-- Each refusal names the rule in force to name instead, or that none
-- stands.
CREATE FUNCTION motion.withhold_flaw(circle text, policy text, day date) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN withhold_flaw.circle IS DISTINCT FROM circle.assembly()
      THEN 'open books'' disclosure rule is the assembly''s: withhold it on the page of '
        || circle.assembly() || ', not of ' || coalesce(withhold_flaw.circle, 'no circle')
    WHEN d.policy IS NULL
      THEN 'no disclosure rule stands on ' || withhold_flaw.day || ', so there is none to withhold'
    WHEN withhold_flaw.policy IS DISTINCT FROM d.policy
      THEN 'withholding open books ends the disclosure rule in force, ' || d.policy || ', and nothing else, not '
        || coalesce(withhold_flaw.policy, 'no policy') || ': name ' || d.policy
  END
  FROM (SELECT) one
  LEFT JOIN circle.disclosed(withhold_flaw.day) d ON true;
END;

-- The rules a motion would adopt that set open books' disclosure values
-- or publish parts of the structure, each with the days it would apply
-- were the motion closed at its deadline and the policy it replaces, as
-- `circle.overlap_flaw` judges them; none whose days are not written
-- YYYY-MM-DD, which `motion.asks` refuses.
CREATE FUNCTION motion.standing_rules(motion text) RETURNS TABLE (n integer, what text, day date, until date, replaces text)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT m.n, CASE WHEN k.marked ? 'publish' THEN 'publication' ELSE 'disclosure' END,
         coalesce((m.args ->> 'from')::date, d.deadline), (m.args ->> 'until')::date, nullif(m.args ->> 'replaces', '')
  FROM motion.action m
  JOIN motion.motion d ON d.id = m.motion
  CROSS JOIN LATERAL (SELECT coalesce(motion.marked(m.args ->> 'wording'), '{}') AS marked) k
  WHERE m.motion = standing_rules.motion AND m.kind = 'policy' AND m.args ->> 'kind' = 'rule'
    AND coalesce(m.args ->> 'from', '') ~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
    AND coalesce(m.args ->> 'until', '') ~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
    AND (k.marked ? 'publish' OR EXISTS (SELECT FROM jsonb_object_keys(k.marked) x WHERE x LIKE 'disclosure\_%'));
END;

-- motion:motion:propose — each action of these kinds names what it
-- applies to, and the motion's circle may decide it: for a mandate
-- policy, whose values core's circles holds sound (`circle_policy.mandate_flaw`),
-- about the role's circle, and the procedure it asks, if any, is one the
-- motion feat holds or the motion adopts; for a right policy, whose
-- values it holds sound (`circle_policy.right_flaw`), about every circle; for
-- the end of a mandate's policy, the motion's circle is on its chain as
-- an issuer, the one that issued it or one that issued a mandate it is
-- issued under, the assembly on every chain; for the end of a right's,
-- the assembly. And each end or replacement of a policy granting the assembly a
-- collective `adopt-policy` mandate with no `until`
-- (`circle.sovereign_by`) leaves it, with the actions before it, still
-- keeping one in force on the verdict date (`circle.sovereignty`):
-- another adopted earlier in the motion with no `from` and no `until`,
-- or one in force it holds that the motion does not end.
-- A rule marking open books' disclosure values, or the parts of the
-- structure it publishes, is the assembly's and marks them soundly
-- (`circle_policy.disclosure_flaw`, `circle.publication_flaw`); one of each
-- stands at a time, so such a rule replaces the one its days meet
-- (`circle.overlap_flaw`), and a motion adopts no two of a kind whose
-- days meet.
CREATE FUNCTION motion.circle_asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN m.kind = 'policy' AND m.args ->> 'kind' = 'mandate' AND circle_policy.mandate_flaw(motion.marked(m.args ->> 'wording')) IS NOT NULL
        THEN circle_policy.mandate_flaw(motion.marked(m.args ->> 'wording'))
      WHEN m.kind = 'policy' AND m.args ->> 'kind' = 'right' AND circle_policy.right_flaw(motion.marked(m.args ->> 'wording')) IS NOT NULL
        THEN circle_policy.right_flaw(motion.marked(m.args ->> 'wording'))
      WHEN m.kind = 'policy' AND m.args ->> 'kind' = 'mandate' AND v.procedure IS NOT NULL
        AND NOT EXISTS (SELECT FROM motion.procedure o WHERE o.id = v.procedure)
        AND NOT EXISTS (
          SELECT FROM motion.action o
          WHERE o.motion = m.motion AND o.kind = 'policy' AND o.args ->> 'kind' = 'procedure'
            AND btrim(motion.marked(o.args ->> 'wording') ->> 'procedure') = v.procedure
        )
        THEN 'no procedure ' || v.procedure || ' for a mandate to ask: a mandate asks a procedure the co-op has, or one its motion adopts'
      WHEN m.kind = 'end' AND x.id IS NOT NULL
        AND NOT EXISTS (SELECT FROM circle.chain(x.id) k WHERE k.issuer = d.circle)
        THEN d.circle || ' may not decide to revoke mandate ' || x.id || ' in ' || coalesce(m.circle, 'every working circle')
          || ': it issued neither it nor a mandate it is issued under'
      WHEN m.kind = 'policy' AND NOT motion.decides(d.circle, coalesce(m.circle, '*'))
        OR (m.kind = 'end' AND x.id IS NULL AND NOT motion.decides(d.circle, '*'))
        THEN d.circle || ' may not decide to '
          || CASE m.kind WHEN 'policy' THEN CASE m.args ->> 'kind' WHEN 'right' THEN 'give a right' ELSE 'grant a mandate' END ELSE 'end a right' END
          || ' in ' || coalesce(m.circle, 'every working circle')
    END AS r
    FROM motion.circle_action m
    JOIN motion.motion d ON d.id = m.motion
    LEFT JOIN circle.mandate x ON m.kind = 'end' AND x.policy = m.args ->> 'policy'
    CROSS JOIN LATERAL (SELECT btrim(motion.marked(m.args ->> 'wording') ->> 'procedure') AS procedure) v
    WHERE m.motion = payload ->> 'motion'
    UNION ALL
    SELECT circle.sovereignty(
      ARRAY(SELECT coalesce(o.args ->> 'policy', o.args ->> 'replaces') FROM motion.action o
            WHERE o.motion = m.motion AND o.n <= m.n
              AND ((o.kind = 'end' AND o.args ? 'policy') OR (o.kind = 'policy' AND nullif(o.args ->> 'replaces', '') IS NOT NULL))),
      (SELECT coalesce(jsonb_agg(motion.marked(o.args ->> 'wording') || jsonb_build_object('from', o.args ->> 'from', 'until', o.args ->> 'until')), '[]')
       FROM motion.action o
       WHERE o.motion = m.motion AND o.n <= m.n AND o.kind = 'policy' AND o.args ->> 'kind' = 'mandate')
    )
    FROM motion.action m
    WHERE m.motion = payload ->> 'motion'
      AND circle.sovereign_by(CASE m.kind WHEN 'end' THEN m.args ->> 'policy' WHEN 'policy' THEN nullif(m.args ->> 'replaces', '') END)
    UNION ALL
    SELECT circle_policy.disclosure_flaw(k.marks, d.circle)
    FROM motion.action m
    JOIN motion.motion d ON d.id = m.motion
    CROSS JOIN LATERAL (
      SELECT jsonb_object_agg(p.name, jsonb_build_object('literal', p.literal, 'stricter', p.stricter)) AS marks
      FROM policy.marks(m.args ->> 'wording') p
    ) k
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'policy' AND m.args ->> 'kind' = 'rule'
    UNION ALL
    SELECT circle.publication_flaw(k.marks, d.circle)
    FROM motion.action m
    JOIN motion.motion d ON d.id = m.motion
    CROSS JOIN LATERAL (
      SELECT jsonb_object_agg(p.name, jsonb_build_object('literal', p.literal, 'stricter', p.stricter)) AS marks
      FROM policy.marks(m.args ->> 'wording') p
    ) k
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'policy' AND m.args ->> 'kind' = 'rule'
    UNION ALL
    SELECT coalesce(
      circle.overlap_flaw(s.what, s.day, s.until, s.replaces, NULL),
      (SELECT 'actions ' || o.n || ' and ' || s.n || ' of ' || (payload ->> 'motion') || ' are both '
         || CASE s.what WHEN 'disclosure' THEN 'a disclosure rule' ELSE 'a publication' END
         || ' on days that meet: one stands at a time, so a motion adopts one'
       FROM motion.standing_rules(payload ->> 'motion') o
       WHERE o.what = s.what AND o.n < s.n
         AND (s.until IS NULL OR o.day < s.until) AND (o.until IS NULL OR s.day < o.until)
       ORDER BY o.n LIMIT 1)
    )
    FROM motion.standing_rules(payload ->> 'motion') s
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- The adoption and end of a policy are this feat's, so it attaches core's
-- guards that a
-- mandate policy's mandate is copied and revoked with it, and that every
-- mandate standing is still a root the assembly issued or issued under a
-- parent its issuer holds, and narrower than it, and that the assembly
-- still keeps a collective `adopt-policy` mandate in force with no
-- `until`.
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'motion.circle_asks(jsonb)', 'motion'),
  ('motion:policy:adopt', 'circle_policy.grants(jsonb)', 'motion'),
  ('motion:policy:adopt', 'circle.narrows(jsonb)', 'motion'),
  ('motion:policy:end', 'circle_policy.revokes(jsonb)', 'motion'),
  ('motion:policy:end', 'circle.narrows(jsonb)', 'motion'),
  ('motion:policy:adopt', 'circle_policy.sovereign(jsonb)', 'motion'),
  ('motion:policy:end', 'circle_policy.sovereign(jsonb)', 'motion');

GRANT USAGE ON SCHEMA motion TO cella_app, cella_guards;
GRANT SELECT ON motion.circle_action TO cella_app, cella_guards;
