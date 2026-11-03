-- motion:message:post — the author is an active member seated in the
-- motion's circle on the verdict date: a circle's members deliberate on
-- its motions, as they put and close them; or seated in the circle the
-- motion's procedure consults, so that circle is heard.
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:message:post', 'circle_membership_motion.sits(jsonb)', 'circle-membership-motion');

-- motion:motion:close — a motion whose procedure consults a circle
-- closes only once someone whose seat in that circle counted on the day
-- they posted it has said something on its deliberation.
CREATE FUNCTION circle_membership_motion.consulted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT d.id || ' is decided by ' || o.id || ', which consults ' || o.consult
    || ': it closes once someone seated in ' || o.consult || ' has said something on it'
  FROM motion.motion d
  JOIN motion.procedure o ON o.id = d.procedure
  WHERE d.id = payload ->> 'motion' AND o.consult IS NOT NULL
    AND NOT EXISTS (
      SELECT FROM motion.message g
      WHERE g.motion = d.id
        AND circle_membership.sits_in(g.member, o.consult, g.at)
    );
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:close', 'circle_membership_motion.consulted(jsonb)', 'circle-membership-motion');
