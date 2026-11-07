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
-- period and its scope, and the circle also holds, standing on `day`, a
-- collective mandate for its power that a mandate of those values from
-- `day` is no wider than (`circle.wider`), the one it issues the grant
-- under, so `circle.narrows` never refuses the grant for its issuer.
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
         WHERE u.grantee = c.id
           AND u.power = decider."grant" ->> 'power'
           AND (u."from" IS NULL OR u."from" <= decider.day)
           AND (u.until IS NULL OR u.until > decider.day)
           AND (u.revoked IS NULL OR u.revoked > decider.day)
           AND circle.wider(
             decider."grant" ->> 'power',
             ((decider."grant" ->> 'limit')::bigint)::cella.amount,
             ((decider."grant" ->> 'budget')::bigint)::cella.amount,
             decider."grant" ->> 'per',
             decider."grant" ->> 'scope',
             decider.day,
             NULL,
             u.id
           ) IS NULL))
     ORDER BY c.id
     LIMIT 1),
    circle.assembly()
  );
END;

-- motion:motion:propose — each action of these kinds names what it
-- applies to, and the motion's circle may decide it: for a mandate
-- policy, whose values core's circles holds sound (`circle.mandate_flaw`),
-- about the role's circle, and the procedure it asks, if any, is one the
-- motion feat holds or the motion adopts; for a right policy, whose
-- values it holds sound (`circle.right_flaw`), about every circle; for
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
-- (`circle.disclosure_flaw`, `circle.publication_flaw`).
CREATE FUNCTION motion.circle_asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN m.kind = 'policy' AND m.args ->> 'kind' = 'mandate' AND circle.mandate_flaw(motion.marked(m.args ->> 'wording')) IS NOT NULL
        THEN circle.mandate_flaw(motion.marked(m.args ->> 'wording'))
      WHEN m.kind = 'policy' AND m.args ->> 'kind' = 'right' AND circle.right_flaw(motion.marked(m.args ->> 'wording')) IS NOT NULL
        THEN circle.right_flaw(motion.marked(m.args ->> 'wording'))
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
    SELECT circle.disclosure_flaw(k.marks, d.circle)
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
  ('motion:policy:adopt', 'circle.grants(jsonb)', 'motion'),
  ('motion:policy:adopt', 'circle.narrows(jsonb)', 'motion'),
  ('motion:policy:end', 'circle.revokes(jsonb)', 'motion'),
  ('motion:policy:end', 'circle.narrows(jsonb)', 'motion'),
  ('motion:policy:adopt', 'circle.sovereign(jsonb)', 'motion'),
  ('motion:policy:end', 'circle.sovereign(jsonb)', 'motion');

GRANT USAGE ON SCHEMA motion TO cella_app, cella_guards;
GRANT SELECT ON motion.circle_action TO cella_app, cella_guards;
