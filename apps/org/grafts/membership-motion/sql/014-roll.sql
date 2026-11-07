-- A motion's roll is fixed by this graft's own proposal, in its write,
-- and no longer by a trigger on the motion feat's table (writes stay
-- home): its handler calls `fix` after the motion feat's `proposing`,
-- and `fixed` refuses a proposal that did not.
DROP TRIGGER fix_roll ON motion.motion;
DROP FUNCTION membership_motion.fix_roll();

-- Who a motion's procedure calls to its roll: the people seated in its
-- circle on the day it is proposed, in the membership feat's seats, a lower
-- order than this graft; every seat, or where the procedure's parties
-- name roles that vote the seats in them (`participant` is every seat),
-- and the seats in a role that vetoes, each so marked (`motion.calls`). Only the motion's
-- own circle's seats are read, so a seat above carries no vote below;
-- seats are people's, so no agent and no service is ever called.
CREATE FUNCTION membership_motion.called(ref text) RETURNS TABLE (member text, veto boolean)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT s.member, coalesce(bool_or(EXISTS (
    SELECT FROM motion.party q WHERE q.procedure = p.id AND q.kind = 'vetoes' AND q.grantee = s.role
  )), false)
  FROM motion.motion d
  JOIN motion.procedure p ON p.id = d.procedure
  JOIN circle.seat s ON s.circle = d.circle
    AND (s.since IS NULL OR s.since <= d.proposed)
    AND (s.until IS NULL OR s.until > d.proposed)
  WHERE d.id = ref
    AND (motion.calls(p.id) IS NULL OR s.role = ANY (motion.calls(p.id)))
  GROUP BY s.member;
END;

-- Fixes a motion's roll as it is proposed: those its procedure calls;
-- returns how many. It runs with its owner's rights, since nothing else
-- writes the table.
CREATE FUNCTION membership_motion.fix(ref text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO membership_motion.roll (motion, member, veto)
  SELECT ref, c.member, c.veto FROM membership_motion.called(ref) c;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

REVOKE EXECUTE ON FUNCTION membership_motion.fix(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION membership_motion.fix(text) TO cella_app;

-- motion:motion:propose — the motion's roll is exactly those its
-- procedure calls on the day it is proposed, each who may veto marked
-- so: the proposal fixed it.
CREATE FUNCTION membership_motion.fixed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT c.member, c.veto FROM membership_motion.called(d.id) c)
      EXCEPT
      (SELECT r.member, r.veto FROM membership_motion.roll r WHERE r.motion = d.id)
    ) OR EXISTS (
      (SELECT r.member, r.veto FROM membership_motion.roll r WHERE r.motion = d.id)
      EXCEPT
      (SELECT c.member, c.veto FROM membership_motion.called(d.id) c)
    ) THEN d.id || '''s proposal did not fix its roll: its roll is those its procedure calls in ' || d.circle || ' on the day it is proposed'
  END
  FROM (SELECT payload ->> 'motion' AS motion) p
  JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'membership_motion.fixed(jsonb)', 'membership-motion');
