-- A decision is taken by open or secret ballot, fixed as it is proposed:
-- its procedure's, unless the proposal names the other. The built-in
-- procedures are open; election is a majority by secret ballot.
ALTER TABLE decision.procedure
  ADD COLUMN ballot text NOT NULL DEFAULT 'open' CHECK (ballot IN ('open', 'secret'));

INSERT INTO decision.procedure (id, label, rule, ballot) VALUES ('election', 'Election', 'majority', 'secret');

ALTER TABLE decision.decision
  ADD COLUMN ballot text NOT NULL DEFAULT 'open' CHECK (ballot IN ('open', 'secret'));

-- Whether a decision is taken by secret ballot.
CREATE FUNCTION decision.secret(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce((SELECT d.ballot = 'secret' FROM decision.decision d WHERE d.id = ref), false);
END;

-- A stance is personal data of its member, kept as the books are: on a
-- secret ballot the vote logs it by its commitment, and the vault keeps
-- it under the member's key. The sweep redacts it once its clock runs out
-- after the member's erasure, so the marker is a stance too, one that
-- counts as none given.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('decision', 'vote', 'stance', 'books', 'member', 'decision');

ALTER TABLE decision.vote
  DROP CONSTRAINT vote_stance_check,
  ADD CONSTRAINT vote_stance_check CHECK (stance IN ('for', 'against', 'abstain', 'consent', 'object', 'redacted'));

-- Who reads a stance: every member an open ballot's; a secret ballot's,
-- its member alone, under no power. A write's transaction and the guards
-- role read every stance.
ALTER TABLE decision.vote ENABLE ROW LEVEL SECURITY;

CREATE POLICY reads ON decision.vote FOR SELECT TO cella_app
  USING ((SELECT cella.writing()) OR member = cella.reader() OR NOT decision.secret(decision));
CREATE POLICY guards ON decision.vote FOR SELECT TO cella_guards USING (true);
CREATE POLICY writes ON decision.vote FOR INSERT TO cella_app WITH CHECK (true);

-- decision:decision:propose — the decision's ballot is the one the
-- payload names.
CREATE FUNCTION decision.balloted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.ballot IS DISTINCT FROM p.ballot THEN d.id || ' is taken by ' || d.ballot || ' ballot, not ' || coalesce(p.ballot, 'none named')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'ballot' AS ballot) p
  JOIN decision.decision d ON d.id = p.decision;
END;

-- decision:decision:vote — a stance on a secret ballot is logged by its
-- commitment alone, one on an open ballot as given.
CREATE FUNCTION decision.seals(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN decision.secret(p.decision) AND NOT p.committed
      THEN p.decision || ' is a secret ballot: its stance is logged by its commitment alone'
    WHEN NOT decision.secret(p.decision) AND p.committed
      THEN p.decision || ' is an open ballot: its stance is logged as given'
  END
  FROM (
    SELECT payload ->> 'decision' AS decision,
           coalesce(jsonb_typeof(payload -> 'stance') = 'object' AND payload -> 'stance' ? '$commit', false) AS committed
  ) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('decision:decision:propose', 'decision.balloted(jsonb)', 'decision'),
  ('decision:decision:vote', 'decision.seals(jsonb)', 'decision');
