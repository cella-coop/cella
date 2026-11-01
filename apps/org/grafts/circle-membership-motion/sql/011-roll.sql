-- A motion's roll is fixed by this graft's own proposal, in its write,
-- and no longer by a trigger on the motion feat's table (writes stay
-- home): its handler calls `fix` after the motion feat's `proposing`,
-- and `fixed` refuses a proposal that did not.
DROP TRIGGER fix_roll ON motion.motion;
DROP FUNCTION circle_membership_motion.fix_roll();

-- Fixes a motion's roll as it is proposed: the members seated in its
-- circle on the day it is proposed, from circle-membership's seats, a
-- lower order than this graft; returns how many. It runs with its
-- owner's rights, since nothing else writes the table.
CREATE FUNCTION circle_membership_motion.fix(ref text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO circle_membership_motion.roll (motion, member)
  SELECT d.id, s FROM motion.motion d CROSS JOIN LATERAL circle_membership.seated(d.circle, d.proposed) s
  WHERE d.id = ref;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

REVOKE EXECUTE ON FUNCTION circle_membership_motion.fix(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION circle_membership_motion.fix(text) TO cella_app;

-- motion:motion:propose — the motion's roll is exactly the members
-- seated in its circle on the day it is proposed: the proposal fixed it.
CREATE FUNCTION circle_membership_motion.fixed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT s FROM circle_membership.seated(d.circle, d.proposed) s)
      EXCEPT
      (SELECT r.member FROM circle_membership_motion.roll r WHERE r.motion = d.id)
    ) OR EXISTS (
      (SELECT r.member FROM circle_membership_motion.roll r WHERE r.motion = d.id)
      EXCEPT
      (SELECT s FROM circle_membership.seated(d.circle, d.proposed) s)
    ) THEN d.id || '''s proposal did not fix its roll: its roll is those seated in ' || d.circle || ' on the day it is proposed'
  END
  FROM (SELECT payload ->> 'motion' AS motion) p
  JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'circle_membership_motion.fixed(jsonb)', 'circle-membership-motion');
