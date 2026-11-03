CREATE SCHEMA circle_motion;

-- What a motion may decide of the circles, registered with the motion
-- feat so its New form offers it: nesting a circle under another. A
-- mandate is a policy, adopted and ended by the motion feat's own kinds,
-- `policy` and `end`, which this graft extends with the circle feat's copy.
SELECT motion.register_carries('nest', 'Nest a circle', '[{"name": "circle", "label": "Circle", "type": "text"}, {"name": "parent", "label": "Under", "type": "text"}]', 'circle:circle:nest', 'circle-motion');

-- Which circle an action is about: the circle nested; for a mandate
-- policy, the circle of the role it marks, or the circle it marks for a
-- collective mandate; for the end of a policy that granted a mandate,
-- the circle of the mandate's role, or the circle that is its grantee.
-- A role every working circle has (`*`) is the assembly's to grant, and
-- so is a right, which reaches every circle: neither names one.
CREATE VIEW circle_motion.action AS
SELECT m.motion, m.n, m.kind, m.args,
       CASE m.kind
         WHEN 'nest' THEN m.args ->> 'circle'
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
WHERE m.kind = 'nest'
  OR (m.kind = 'policy' AND m.args ->> 'kind' IN ('mandate', 'right'))
  OR (m.kind = 'end' AND EXISTS (SELECT FROM circle.mandate x WHERE x.policy = m.args ->> 'policy'))
  OR (m.kind = 'end' AND EXISTS (SELECT FROM circle.right x WHERE x.policy = m.args ->> 'policy'));

-- Whether a motion of the circle `decider` may decide about the circle
-- `subject`: the assembly decides about every circle, and a circle about
-- those strictly within it. A circle does not decide its own place or
-- powers; its parent does. With no circle named (`*`), the assembly alone.
CREATE FUNCTION circle_motion.decides(decider text, subject text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (SELECT FROM circle.circle b WHERE b.id = decides.decider AND b.parent IS NULL)
    OR (decides.decider IS DISTINCT FROM decides.subject AND circle.within(decides.subject, decides.decider));
END;

-- motion:motion:propose — each action of these kinds names what it
-- applies to, and the motion's circle may decide it: about the circle
-- nested, and the place it moves to; for a mandate policy, whose values
-- the circle feat holds sound (`circle.mandate_flaw`), about the role's
-- circle; for a right policy, whose values it holds sound
-- (`circle.right_flaw`), about every circle; for the end of one, about
-- its mandate's or its right's.
CREATE FUNCTION circle_motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN m.kind = 'nest' AND NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = m.args ->> 'circle')
        THEN 'no circle ' || coalesce(m.args ->> 'circle', 'is named') || ' to nest'
      WHEN m.kind = 'nest' AND NOT EXISTS (SELECT FROM circle.circle c WHERE c.id = m.args ->> 'parent')
        THEN 'no circle ' || coalesce(m.args ->> 'parent', 'is named') || ' to nest under'
      WHEN m.kind = 'policy' AND m.args ->> 'kind' = 'mandate' AND circle.mandate_flaw(motion.marked(m.args ->> 'wording')) IS NOT NULL
        THEN circle.mandate_flaw(motion.marked(m.args ->> 'wording'))
      WHEN m.kind = 'policy' AND m.args ->> 'kind' = 'right' AND circle.right_flaw(motion.marked(m.args ->> 'wording')) IS NOT NULL
        THEN circle.right_flaw(motion.marked(m.args ->> 'wording'))
      WHEN NOT circle_motion.decides(d.circle, coalesce(m.circle, '*'))
        OR (m.kind = 'nest' AND NOT circle_motion.decides(d.circle, m.args ->> 'parent') AND d.circle IS DISTINCT FROM m.args ->> 'parent')
        THEN d.circle || ' may not decide to '
          || CASE m.kind WHEN 'nest' THEN 'nest' WHEN 'policy' THEN CASE m.args ->> 'kind' WHEN 'right' THEN 'give a right' ELSE 'grant a mandate' END ELSE 'revoke a mandate' END
          || ' in ' || coalesce(m.circle, 'every working circle')
    END AS r
    FROM circle_motion.action m
    JOIN motion.motion d ON d.id = m.motion
    WHERE m.motion = payload ->> 'motion'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- circle:circle:nest — the cited motion nests this circle under this
-- parent.
CREATE FUNCTION circle_motion.nests(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM circle_motion.action m
      WHERE m.motion = d.id AND m.kind = 'nest' AND m.args ->> 'circle' = p.circle AND m.args ->> 'parent' = p.parent
    ) THEN d.id || ' does not nest ' || coalesce(p.circle, 'a circle') || ' under ' || coalesce(p.parent, 'another')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'circle' AS circle, payload ->> 'parent' AS parent) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- The adoption and end of a policy are the motion feat's; this graft,
-- joining it to the circle feat, attaches the circle feat's guards that a
-- mandate policy's mandate is copied and revoked with it, and that every
-- mandate standing is still a root the assembly issued or issued under a
-- parent its issuer holds, and narrower than it.
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'circle_motion.asks(jsonb)', 'circle-motion'),
  ('circle:circle:nest', 'circle_motion.nests(jsonb)', 'circle-motion'),
  ('motion:policy:adopt', 'circle.grants(jsonb)', 'circle-motion'),
  ('motion:policy:adopt', 'circle.narrows(jsonb)', 'circle-motion'),
  ('motion:policy:end', 'circle.revokes(jsonb)', 'circle-motion'),
  ('motion:policy:end', 'circle.narrows(jsonb)', 'circle-motion');
SELECT motion.register_cite('circle:circle:nest', 'nest-circle', 'circle-motion');

GRANT USAGE ON SCHEMA circle_motion TO cella_app, cella_guards;
GRANT SELECT ON circle_motion.action TO cella_app, cella_guards;
