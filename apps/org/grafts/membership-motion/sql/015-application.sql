-- membership:member:apply — an employee's application put the motion to
-- admit them, in its own write: the motion its payload names asks only to
-- admit the applicant, with the shares they pledge, and passes every
-- check a proposal does but the seat: it was proposed by this write
-- (`motion.proposes`), on the ballot named (`balloted`), by a procedure
-- in force (`decides_by`), in the circle holding the collective mandate
-- to admit (`motion.empowers`), by the procedure its requirements
-- fix (`motion.requires`),
-- someone invited with a whole number of shares (`membership_motion.asks`),
-- its roll fixed (`fixed`). No seat is asked of the applicant: their
-- right puts it, so `sits` is not run.
CREATE FUNCTION membership_motion.puts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    CASE
      WHEN d.id IS NULL THEN coalesce(p.member, 'no one') || '''s application puts no motion to admit them'
      WHEN (SELECT count(*) FROM motion.action a WHERE a.motion = d.id) <> 1
        OR NOT EXISTS (SELECT FROM membership_motion.action a WHERE a.motion = d.id AND a.kind = 'admit' AND a.member = p.member)
        THEN d.id || ' does not ask only to admit ' || coalesce(p.member, 'the applicant')
    END,
    motion.proposes(payload),
    motion.balloted(payload),
    motion.decides_by(payload),
    motion.empowers(payload),
    motion.requires(payload),
    membership_motion.asks(payload),
    membership_motion.fixed(payload)
  )
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'motion' AS motion) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('membership:member:apply', 'membership_motion.puts(jsonb)', 'membership-motion');
