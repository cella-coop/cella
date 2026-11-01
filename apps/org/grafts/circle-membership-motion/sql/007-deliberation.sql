-- motion:message:post — the author is an active member seated in the
-- motion's circle on the verdict date: a circle's members deliberate on
-- its motions, as they put and close them.
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:message:post', 'circle_membership_motion.sits(jsonb)', 'circle-membership-motion');
