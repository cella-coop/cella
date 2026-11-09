-- The power a stance needs, `vote`, which no mandate grants: a motion's
-- procedure gives it to the seats on its roll, and the graft that fixes
-- the roll judges it. The feat registers it here, as cella.power and
-- motion.cites hold theirs, so the action's label is checked against it.
CREATE TABLE motion.stance_power (
  op text PRIMARY KEY,
  power text NOT NULL CHECK (power ~ '^[a-z][a-z-]*$'),
  owner text NOT NULL
);

INSERT INTO motion.stance_power (op, power, owner) VALUES ('motion:motion:vote', 'vote', 'motion');

GRANT SELECT ON motion.stance_power TO cella_app, cella_guards;

-- motion:motion:vote — a stance is the actor's own: no one votes for
-- another. That the actor holds `vote`, on the motion's roll with a seat
-- that counts, is `motion.on_roll` on the same
-- op.
CREATE FUNCTION motion.own_stance(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.member IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not vote for ' || coalesce(p.member, 'no one')
  END
  FROM (SELECT payload ->> 'member' AS member) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:vote', 'motion.own_stance(jsonb)', 'motion');

COMMENT ON TABLE motion.stance_power IS 'registry: the power a stance needs, as the feat registers it';
