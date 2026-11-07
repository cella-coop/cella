-- motion:message:post — the author is an active member seated in the
-- motion's circle on the verdict date: a circle's members deliberate on
-- its motions, as they put and close them; or seated in the circle the
-- motion's procedure consults, so that circle is heard.
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:message:post', 'membership_motion.sits(jsonb)', 'membership-motion');

-- motion:motion:close — a motion whose procedure consults a circle
-- closes only once someone whose seat in that circle counted on the day
-- they posted it has said something on its deliberation.
CREATE FUNCTION membership_motion.consulted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT d.id || ' is decided by ' || o.id || ', which consults ' || motion.consults(o.id)
    || ': it closes once someone seated in ' || motion.consults(o.id) || ' has said something on it'
  FROM motion.motion d
  JOIN motion.procedure o ON o.id = d.procedure
  WHERE d.id = payload ->> 'motion' AND motion.consults(o.id) IS NOT NULL
    AND NOT EXISTS (
      SELECT FROM motion.message g
      WHERE g.motion = d.id
        AND membership.sits_in(g.member, motion.consults(o.id), g.at)
    );
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:close', 'membership_motion.consulted(jsonb)', 'membership-motion');
