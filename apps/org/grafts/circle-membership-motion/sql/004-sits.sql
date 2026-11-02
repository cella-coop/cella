-- motion:motion:propose, motion:motion:close — the actor is an
-- active member seated in the motion's circle on the verdict date: the
-- participant's `propose` and `discuss`, which circle_membership.may
-- finds on any seat, are held in the motion's circle.
CREATE FUNCTION circle_membership_motion.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is named')
    WHEN NOT EXISTS (SELECT FROM circle_membership.seated(d.circle, cella.verdict_date()) s WHERE s = cella.actor())
      OR NOT EXISTS (SELECT FROM membership.member m WHERE m.address = cella.actor() AND m.status = 'active')
      THEN cella.actor() || ' holds no seat in ' || d.circle || ', so may not ' || split_part(cella.action(), ':', 3) || ' ' || d.id
  END
  FROM (SELECT payload ->> 'motion' AS motion) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'circle_membership_motion.sits(jsonb)', 'circle-membership-motion'),
  ('motion:motion:close', 'circle_membership_motion.sits(jsonb)', 'circle-membership-motion');
