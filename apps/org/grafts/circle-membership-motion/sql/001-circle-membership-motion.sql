CREATE SCHEMA circle_membership_motion;

-- Who may vote on a motion: the members seated in its circle on the day
-- it was proposed, fixed when it is proposed. The motion is named by id
-- and the member by address, with no foreign key into either feat.
CREATE TABLE circle_membership_motion.roll (
  motion text NOT NULL,
  member text NOT NULL,
  PRIMARY KEY (motion, member)
);

-- Fixes a motion's roll from the seats in its circle, the circle-membership
-- graft's, a lower order than this one. The roll is this trigger's alone to
-- write, so it runs with its owner's rights.
CREATE FUNCTION circle_membership_motion.fix_roll() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO circle_membership_motion.roll (motion, member)
  SELECT NEW.id, s FROM circle_membership.seated(NEW.circle, NEW.proposed) s;
  RETURN NULL;
END
$$;

CREATE TRIGGER fix_roll AFTER INSERT ON motion.motion
  FOR EACH ROW EXECUTE FUNCTION circle_membership_motion.fix_roll();

-- Whether a motion passes by its method, over the stances received before
-- its cutoff from the members on its roll who are active.
CREATE FUNCTION circle_membership_motion.passes(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE d.method
    WHEN 'consent' THEN (
      SELECT cella.consent(v.member, v.stance, v.receipt)
      FROM motion.vote v
      JOIN circle_membership_motion.roll r ON r.motion = v.motion AND r.member = v.member
      JOIN membership.member m ON m.address = v.member AND m.status = 'active'
      WHERE v.motion = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    )
    WHEN 'majority' THEN (
      SELECT cella.majority(v.member, v.stance, v.receipt)
      FROM motion.vote v
      JOIN circle_membership_motion.roll r ON r.motion = v.motion AND r.member = v.member
      JOIN membership.member m ON m.address = v.member AND m.status = 'active'
      WHERE v.motion = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    )
  END
  FROM motion.motion d
  WHERE d.id = ref;
END;

-- Every write in motion.cites — the cited motion closed, and passes on
-- its roll.
CREATE FUNCTION circle_membership_motion.carried(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN d.closed IS NULL THEN d.id || ' is not closed'
    WHEN NOT circle_membership_motion.passes(d.id) THEN d.id || ' does not pass by ' || d.method
  END
  FROM (SELECT payload ->> 'motion' AS motion) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- The guard attaches to every op that cites a motion: those the lower
-- grafts declared before this one migrated, and any declared after.
INSERT INTO cella.guard (op, fn, owner)
SELECT c.op, 'circle_membership_motion.carried(jsonb)'::regprocedure, 'circle-membership-motion' FROM motion.cites c;

CREATE FUNCTION circle_membership_motion.attach() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO cella.guard (op, fn, owner)
  VALUES (NEW.op, 'circle_membership_motion.carried(jsonb)', 'circle-membership-motion');
  RETURN NULL;
END
$$;

CREATE TRIGGER attach AFTER INSERT ON motion.cites
  FOR EACH ROW EXECUTE FUNCTION circle_membership_motion.attach();

GRANT USAGE ON SCHEMA circle_membership_motion TO cella_app, cella_guards;
GRANT SELECT ON circle_membership_motion.roll TO cella_app, cella_guards;
