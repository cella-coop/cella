-- motion:motion:vote — a stance is the actor's own: no member votes for
-- another. Whether the actor is on the motion's roll is the
-- circle-membership-motion graft's guard on the same op.
CREATE FUNCTION motion.own_stance(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.member IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not vote for ' || coalesce(p.member, 'no one')
  END
  FROM (SELECT payload ->> 'member' AS member) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:vote', 'motion.own_stance(jsonb)', 'motion');
