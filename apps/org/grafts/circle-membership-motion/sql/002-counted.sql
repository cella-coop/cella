-- motion:motion:vote — the member is on the motion's roll.
CREATE FUNCTION circle_membership_motion.on_roll(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT FROM circle_membership_motion.roll r WHERE r.motion = p.motion AND r.member = p.member
    ) THEN coalesce(p.member, 'no one') || ' is not on the roll of ' || coalesce(p.motion, 'no motion')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'member' AS member) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:vote', 'circle_membership_motion.on_roll(jsonb)', 'circle-membership-motion');

-- Who was counted: the members of a motion's roll who were active when
-- it closed, fixed by the close, so a later suspension or exit cannot
-- change its outcome.
CREATE TABLE circle_membership_motion.counted (
  motion text NOT NULL,
  member text NOT NULL,
  PRIMARY KEY (motion, member)
);

-- Fixes who was counted as the close writes the motion: in the close's
-- transaction, so a refused close leaves nothing. It runs with its owner's
-- rights, since nothing else writes the table.
CREATE FUNCTION circle_membership_motion.count_roll() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO circle_membership_motion.counted (motion, member)
  SELECT r.motion, r.member
  FROM circle_membership_motion.roll r
  JOIN membership.member m ON m.address = r.member AND m.status = 'active'
  WHERE r.motion = NEW.id;
  RETURN NULL;
END
$$;

CREATE TRIGGER count_roll AFTER UPDATE OF closed ON motion.motion
  FOR EACH ROW WHEN (OLD.closed IS NULL AND NEW.closed IS NOT NULL)
  EXECUTE FUNCTION circle_membership_motion.count_roll();

-- Whether a motion passes by its method, over the stances received before
-- its cutoff: once closed, from those counted at the close; while open,
-- from the members on its roll who are active now.
CREATE OR REPLACE FUNCTION circle_membership_motion.passes(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE d.method
    WHEN 'consent' THEN (
      SELECT cella.consent(v.member, v.stance, v.receipt)
      FROM motion.vote v
      WHERE v.motion = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
        AND v.member IN (
          SELECT c.member FROM circle_membership_motion.counted c WHERE c.motion = d.id AND d.closed IS NOT NULL
          UNION
          SELECT r.member FROM circle_membership_motion.roll r JOIN membership.member m ON m.address = r.member AND m.status = 'active'
          WHERE r.motion = d.id AND d.closed IS NULL
        )
    )
    WHEN 'majority' THEN (
      SELECT cella.majority(v.member, v.stance, v.receipt)
      FROM motion.vote v
      WHERE v.motion = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
        AND v.member IN (
          SELECT c.member FROM circle_membership_motion.counted c WHERE c.motion = d.id AND d.closed IS NOT NULL
          UNION
          SELECT r.member FROM circle_membership_motion.roll r JOIN membership.member m ON m.address = r.member AND m.status = 'active'
          WHERE r.motion = d.id AND d.closed IS NULL
        )
    )
  END
  FROM motion.motion d
  WHERE d.id = ref;
END;

GRANT SELECT ON circle_membership_motion.counted TO cella_app, cella_guards;
