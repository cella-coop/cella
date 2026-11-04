-- Who was counted at a close is fixed by this graft's own close, in its
-- write, and no longer by a trigger on the motion feat's table (writes
-- stay home): its handler calls `count` after the motion feat's
-- `closing`, and `counts` refuses a close that did not.
DROP TRIGGER count_roll ON motion.motion;
DROP FUNCTION membership_motion.count_roll();

-- Fixes who is counted on a motion as it closes: the people of its roll
-- whose seat counts in its circle (`membership.counts`) on the
-- verdict date; returns how many. It
-- runs with its owner's rights, since nothing else writes the table.
CREATE FUNCTION membership_motion.count(ref text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO membership_motion.counted (motion, member)
  SELECT r.motion, r.member
  FROM membership_motion.roll r
  JOIN motion.motion d ON d.id = r.motion
  WHERE r.motion = ref AND membership.counts(r.member, d.circle, cella.verdict_date());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

REVOKE EXECUTE ON FUNCTION membership_motion.count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION membership_motion.count(text) TO cella_app;

-- motion:motion:close — those counted are exactly the people of the
-- motion's roll whose seat counts on the verdict date: the close counted
-- its roll.
CREATE FUNCTION membership_motion.counts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT r.member FROM membership_motion.roll r JOIN motion.motion d ON d.id = r.motion
       WHERE r.motion = p.motion AND membership.counts(r.member, d.circle, cella.verdict_date()))
      EXCEPT
      (SELECT c.member FROM membership_motion.counted c WHERE c.motion = p.motion)
    ) OR EXISTS (
      (SELECT c.member FROM membership_motion.counted c WHERE c.motion = p.motion)
      EXCEPT
      (SELECT r.member FROM membership_motion.roll r JOIN motion.motion d ON d.id = r.motion
       WHERE r.motion = p.motion AND membership.counts(r.member, d.circle, cella.verdict_date()))
    ) THEN coalesce(p.motion, 'no motion') || '''s close did not count its roll: those counted are those of its roll whose seat counts on the day it closes'
  END
  FROM (SELECT payload ->> 'motion' AS motion) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:close', 'membership_motion.counts(jsonb)', 'membership-motion');
