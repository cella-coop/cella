-- A motion is taken by open or secret ballot, fixed as it is proposed:
-- its procedure's, unless the proposal names the other. The built-in
-- procedures are open; election is a majority by secret ballot.
ALTER TABLE motion.procedure
  ADD COLUMN ballot text NOT NULL DEFAULT 'open' CHECK (ballot IN ('open', 'secret'));

INSERT INTO motion.procedure (id, label, method, ballot) VALUES ('election', 'Election', 'majority', 'secret');

ALTER TABLE motion.motion
  ADD COLUMN ballot text NOT NULL DEFAULT 'open' CHECK (ballot IN ('open', 'secret'));

-- Whether a motion is taken by secret ballot.
CREATE FUNCTION motion.secret(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce((SELECT d.ballot = 'secret' FROM motion.motion d WHERE d.id = ref), false);
END;

-- A stance is personal data of its member, kept as the books are: on a
-- secret ballot the vote logs it by its commitment, and the vault keeps
-- it under the member's key. The sweep redacts it once its clock runs out
-- after the member's erasure, so the marker is a stance too, one that
-- counts as none given.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('motion', 'vote', 'stance', 'books', 'member', 'motion');

ALTER TABLE motion.vote
  DROP CONSTRAINT vote_stance_check,
  ADD CONSTRAINT vote_stance_check CHECK (stance IN ('for', 'against', 'abstain', 'consent', 'object', 'redacted'));

-- Who reads a stance: an open ballot's, whoever reads the motion's circle,
-- as core's row-level policy, which this one replaces, would; a secret ballot's,
-- its member alone, under no power. A write's transaction and the guards
-- role read every stance.
ALTER TABLE motion.vote ENABLE ROW LEVEL SECURITY;

DROP POLICY circle ON motion.vote;
CREATE POLICY reads ON motion.vote FOR SELECT TO cella_app
  USING ((SELECT cella.writing()) OR member = cella.reader() OR (NOT motion.secret(motion) AND circle = ANY ((SELECT circle.reads('{motion}'))::text[])));
CREATE POLICY guards ON motion.vote FOR SELECT TO cella_guards USING (true);
CREATE POLICY writes ON motion.vote FOR INSERT TO cella_app WITH CHECK (true);

-- motion:motion:propose — the motion's ballot is the one the
-- payload names.
CREATE FUNCTION motion.balloted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.ballot IS DISTINCT FROM p.ballot THEN d.id || ' is taken by ' || d.ballot || ' ballot, not ' || coalesce(p.ballot, 'none named')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'ballot' AS ballot) p
  JOIN motion.motion d ON d.id = p.motion;
END;

-- motion:motion:vote — a stance on a secret ballot is logged by its
-- commitment alone, one on an open ballot as given.
CREATE FUNCTION motion.seals(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN motion.secret(p.motion) AND NOT p.committed
      THEN p.motion || ' is a secret ballot: its stance is logged by its commitment alone'
    WHEN NOT motion.secret(p.motion) AND p.committed
      THEN p.motion || ' is an open ballot: its stance is logged as given'
  END
  FROM (
    SELECT payload ->> 'motion' AS motion,
           coalesce(jsonb_typeof(payload -> 'stance') = 'object' AND payload -> 'stance' ? '$commit', false) AS committed
  ) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'motion.balloted(jsonb)', 'motion'),
  ('motion:motion:vote', 'motion.seals(jsonb)', 'motion');
