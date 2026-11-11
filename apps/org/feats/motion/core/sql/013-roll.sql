-- The roll: who may vote on a motion and whether it passes, from core's
-- seats and whether each counts (`circle_person.counts`, which asks each
-- kind of person what bars a seat), and this feat's procedures. No graft
-- computes it, so a scope without membership still votes by its seats.

-- Who may vote on a motion: the people its procedure calls, fixed when it
-- is proposed, and whether each may veto it. The motion is named by id
-- and the person by address, with no foreign key into either.
CREATE TABLE motion.roll (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  motion text NOT NULL,
  member text NOT NULL,
  veto boolean NOT NULL DEFAULT false,
  PRIMARY KEY (motion, member)
);

-- Who was counted: the people of a motion's roll whose seat counted in
-- its circle when it closed, fixed by the close, so a later suspension or
-- exit cannot change its outcome.
CREATE TABLE motion.counted (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  motion text NOT NULL,
  member text NOT NULL,
  PRIMARY KEY (motion, member)
);

GRANT SELECT ON motion.roll, motion.counted TO cella_app, cella_guards;

-- Who a motion's procedure calls to its roll: the people seated in its
-- circle on the day it is proposed, in core's seats; every seat, or where
-- the procedure's parties name roles that vote the seats in them
-- (`participant` is every seat), and the seats in a role that vetoes,
-- each so marked (`motion.calls`). Only the motion's own circle's seats
-- are read, so a seat above carries no vote below; seats are people's,
-- so no agent and no service is ever called.
CREATE FUNCTION motion.called(ref text) RETURNS TABLE (member text, veto boolean)
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

-- Fixes a motion's roll as it is proposed, inside `proposing` and its
-- fold: those its procedure calls; returns how many. It runs with its
-- owner's rights, since nothing else writes the table.
CREATE FUNCTION motion.fix(ref text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO motion.roll (motion, member, veto)
  SELECT ref, c.member, c.veto FROM motion.called(ref) c;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

REVOKE EXECUTE ON FUNCTION motion.fix(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION motion.fix(text) TO cella_app;

-- motion:motion:propose — the motion's roll is exactly those its
-- procedure calls on the day it is proposed, each who may veto marked
-- so: the proposal fixed it.
CREATE FUNCTION motion.fixed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT c.member, c.veto FROM motion.called(d.id) c)
      EXCEPT
      (SELECT r.member, r.veto FROM motion.roll r WHERE r.motion = d.id)
    ) OR EXISTS (
      (SELECT r.member, r.veto FROM motion.roll r WHERE r.motion = d.id)
      EXCEPT
      (SELECT c.member, c.veto FROM motion.called(d.id) c)
    ) THEN d.id || '''s proposal did not fix its roll: its roll is those its procedure calls in ' || d.circle || ' on the day it is proposed'
  END
  FROM (SELECT payload ->> 'motion' AS motion) p
  JOIN motion.motion d ON d.id = p.motion;
END;

-- Fixes who is counted on a motion as it closes, inside `closing` and
-- its fold: the people of its roll whose seat counts in its circle on
-- the verdict date; returns how many. It runs with its owner's rights,
-- since nothing else writes the table.
CREATE FUNCTION motion.count(ref text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO motion.counted (motion, member)
  SELECT r.motion, r.member
  FROM motion.roll r
  JOIN motion.motion d ON d.id = r.motion
  WHERE r.motion = ref AND circle_person.counts(r.member, d.circle, cella.verdict_date());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

REVOKE EXECUTE ON FUNCTION motion.count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION motion.count(text) TO cella_app;

-- motion:motion:close — those counted are exactly the people of the
-- motion's roll whose seat counts on the verdict date: the close counted
-- its roll.
CREATE FUNCTION motion.counted_roll(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT r.member FROM motion.roll r JOIN motion.motion d ON d.id = r.motion
       WHERE r.motion = p.motion AND circle_person.counts(r.member, d.circle, cella.verdict_date()))
      EXCEPT
      (SELECT c.member FROM motion.counted c WHERE c.motion = p.motion)
    ) OR EXISTS (
      (SELECT c.member FROM motion.counted c WHERE c.motion = p.motion)
      EXCEPT
      (SELECT r.member FROM motion.roll r JOIN motion.motion d ON d.id = r.motion
       WHERE r.motion = p.motion AND circle_person.counts(r.member, d.circle, cella.verdict_date()))
    ) THEN coalesce(p.motion, 'no motion') || '''s close did not count its roll: those counted are those of its roll whose seat counts on the day it closes'
  END
  FROM (SELECT payload ->> 'motion' AS motion) p;
END;

-- Who counts on a motion: once it is closed, those counted at its close;
-- while it is open, the people on its roll whose seat counts now.
CREATE FUNCTION motion.electorate(ref text) RETURNS SETOF text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT c.member
  FROM motion.counted c
  JOIN motion.motion d ON d.id = c.motion AND d.closed IS NOT NULL
  WHERE c.motion = ref
  UNION
  SELECT r.member
  FROM motion.roll r
  JOIN motion.motion d ON d.id = r.motion AND d.closed IS NULL
  WHERE r.motion = ref AND circle_person.counts(r.member, d.circle, cella.verdict_date());
END;

-- The stances that count on a motion: its electorate's, received before
-- its cutoff, but a stance the sweep redacted, which counts as none given.
CREATE FUNCTION motion.stances(ref text) RETURNS SETOF motion.vote
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT v.*
  FROM motion.vote v
  JOIN motion.motion d ON d.id = v.motion
  WHERE v.motion = ref
    AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    AND v.stance <> 'redacted'
    AND v.member IN (SELECT motion.electorate(ref));
END;

-- How many count on a motion, how many of them gave a stance, and
-- whether that meets its procedure's quorum: at least `quorum_num` in
-- every `quorum_den` of those counted. An abstention takes part.
CREATE FUNCTION motion.turnout(ref text, OUT counted integer, OUT given integer, OUT quorate boolean)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT e.n, s.n, s.n * p.quorum_den >= p.quorum_num * e.n
  FROM motion.motion d
  JOIN motion.procedure p ON p.id = d.procedure
  CROSS JOIN LATERAL (SELECT count(*)::integer AS n FROM motion.electorate(d.id)) e
  CROSS JOIN LATERAL (SELECT count(DISTINCT x.member)::integer AS n FROM motion.stances(d.id) x) s
  WHERE d.id = ref;
END;

-- Whether a motion passes by its procedure, over the stances that count:
-- its quorum met, and then by its method, `cella.consent`, or for a majority
-- `cella.majority`, more for than against, or `cella.share`, the share of
-- the votes cast the procedure needs, as two thirds; and no veto, no one
-- on its roll who may veto it giving, as their latest stance that counts,
-- one against or an objection.
CREATE FUNCTION motion.passes(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT (SELECT t.quorate FROM motion.turnout(d.id) t) AND CASE
    WHEN d.method = 'consent' THEN (
      SELECT cella.consent(s.member, s.stance, s.receipt) FROM motion.stances(d.id) s
    )
    WHEN p.share_num IS NULL THEN (
      SELECT cella.majority(s.member, s.stance, s.receipt) FROM motion.stances(d.id) s
    )
    ELSE (
      SELECT cella.share(s.member, s.stance, s.receipt, p.share_num::bigint, p.share_den::bigint)
      FROM motion.stances(d.id) s
    )
  END
  AND NOT EXISTS (
    SELECT FROM motion.stances(d.id) s
    JOIN motion.roll r ON r.motion = d.id AND r.member = s.member AND r.veto
    WHERE s.stance IN ('against', 'object')
      AND s.receipt = (SELECT max(x.receipt) FROM motion.stances(d.id) x WHERE x.member = s.member)
  )
  FROM motion.motion d
  JOIN motion.procedure p ON p.id = d.procedure
  WHERE d.id = ref;
END;

-- What a reader of the motion reads of its count: whether it passes, how
-- many count, how many of them gave a stance and whether that meets its
-- quorum. A secret ballot's is sealed, every field null, until its close.
-- It runs as its owner, since a member reads no other's secret stance.
CREATE FUNCTION motion.tally(ref text, OUT passes boolean, OUT counted integer, OUT given integer, OUT quorate boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT motion.passes(d.id), t.counted, t.given, t.quorate
  FROM motion.motion d
  CROSS JOIN LATERAL motion.turnout(d.id) t
  WHERE d.id = ref AND (d.closed IS NOT NULL OR NOT motion.secret(d.id))
    AND ((SELECT circle.whole()) OR d.circle = ANY ((SELECT circle.reads('{motion}'))::text[]));
END;

COMMENT ON FUNCTION motion.tally(text) IS 'audience: shared by ref: a motion''s counts, for whoever reads the motion';
REVOKE EXECUTE ON FUNCTION motion.tally(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION motion.tally(text) TO cella_app;

-- motion:motion:vote — the actor holds `vote`, the power the motion's
-- procedure gives the seats on its roll: they are on the roll, and their
-- seat counts in its circle on the verdict date.
CREATE FUNCTION motion.on_roll(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT FROM motion.roll r WHERE r.motion = p.motion AND r.member = p.member
    ) THEN coalesce(p.member, 'no one') || ' is not on the roll of ' || coalesce(p.motion, 'no motion')
    WHEN NOT circle_person.counts(p.member, d.circle, cella.verdict_date())
      THEN p.member || ' may sit in ' || d.circle || ' no longer: '
        || circle_person.unseated(p.member, d.circle, cella.verdict_date())
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'member' AS member) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- motion:motion:propose, motion:motion:close, motion:message:post — who
-- puts, closes and deliberates on a motion holds a seat that counts in
-- its circle on the verdict date: the participant's `propose` and
-- `discuss`, which `circle_person.may` finds on any seat, are held in
-- the motion's circle. A message may be posted, too, from a seat that
-- counts in the circle the motion's procedure consults.
CREATE FUNCTION motion.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is named')
    WHEN NOT circle_person.sits_in(cella.actor(), d.circle, cella.verdict_date())
      AND NOT (cella.action() = 'motion:message:post' AND EXISTS (
        SELECT FROM motion.procedure o
        WHERE o.id = d.procedure AND circle_person.sits_in(cella.actor(), motion.consults(o.id), cella.verdict_date())
      ))
      THEN cella.actor() || ' holds no seat in ' || d.circle || ', so may not ' || split_part(cella.action(), ':', 3) || ' ' || d.id
  END
  FROM (SELECT payload ->> 'motion' AS motion) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- motion:motion:close — a motion whose procedure consults a circle
-- closes only once someone whose seat in that circle counted on the day
-- they posted it has said something on its deliberation.
CREATE FUNCTION motion.consulted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT d.id || ' is decided by ' || o.id || ', which consults ' || motion.consults(o.id)
    || ': it closes once someone seated in ' || motion.consults(o.id) || ' has said something on it'
  FROM motion.motion d
  JOIN motion.procedure o ON o.id = d.procedure
  WHERE d.id = payload ->> 'motion' AND motion.consults(o.id) IS NOT NULL
    AND NOT EXISTS (
      SELECT FROM motion.message g
      WHERE g.motion = d.id
        AND circle_person.sits_in(g.member, motion.consults(o.id), g.at)
    );
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'motion.fixed(jsonb)', 'motion'),
  ('motion:motion:propose', 'motion.sits(jsonb)', 'motion'),
  ('motion:motion:close', 'motion.sits(jsonb)', 'motion'),
  ('motion:message:post', 'motion.sits(jsonb)', 'motion'),
  ('motion:motion:close', 'motion.counted_roll(jsonb)', 'motion'),
  ('motion:motion:close', 'motion.consulted(jsonb)', 'motion'),
  ('motion:motion:vote', 'motion.on_roll(jsonb)', 'motion');

-- Every write in motion.cites — the cited motion closed, and passes on
-- its roll. Registered as every guard covering the list is, so it
-- attaches to the actions listed before and after.
CREATE FUNCTION motion.carried(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN d.closed IS NULL THEN d.id || ' is not closed'
    WHEN NOT motion.passes(d.id) THEN d.id || ' does not pass by ' || d.method
  END
  FROM (SELECT payload ->> 'motion' AS motion) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

SELECT motion.register_cite_guard('motion.carried(jsonb)', 'motion');
