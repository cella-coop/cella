-- How a decision is taken: a procedure names its rule, the stances it
-- counts; for a majority, the share of the votes cast it needs, at least
-- `share_num` in every `share_den` of those for and against, or with none
-- more for than against; and its quorum, how many of those counted must
-- give a stance, at least `quorum_num` in every `quorum_den`. A circle
-- decides by one unless a proposal names another, and a decision keeps
-- the one it was proposed under.
CREATE TABLE decision.procedure (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z-]*$'),
  label text NOT NULL,
  rule text NOT NULL CHECK (rule IN ('consent', 'majority')),
  share_num integer,
  share_den integer,
  quorum_num integer NOT NULL DEFAULT 0,
  quorum_den integer NOT NULL DEFAULT 1,
  CHECK ((share_num IS NULL) = (share_den IS NULL)),
  CHECK (share_num IS NULL OR (rule = 'majority' AND 0 < share_num AND share_num <= share_den)),
  CHECK (0 <= quorum_num AND quorum_num <= quorum_den),
  UNIQUE (id, rule)
);

INSERT INTO decision.procedure (id, label, rule, share_num, share_den) VALUES
  ('consent', 'Consent', 'consent', NULL, NULL),
  ('majority', 'Majority', 'majority', NULL, NULL),
  ('two-thirds', 'Two thirds', 'majority', 2, 3);

-- A procedure a decision was taken under is fixed: its terms are what the
-- decision's stances were counted by.
CREATE FUNCTION decision.procedure_kept() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM decision.decision d WHERE d.procedure = OLD.id) THEN
    RAISE EXCEPTION 'decisions are taken by %: its terms are fixed', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

-- Each decision names its procedure, whose rule is its own. The decisions
-- before procedures were taken by the procedure of their rule's name.
ALTER TABLE decision.decision ADD COLUMN procedure text;
ALTER TABLE decision.decision DISABLE TRIGGER stays_closed;
UPDATE decision.decision SET procedure = rule;
ALTER TABLE decision.decision ENABLE TRIGGER stays_closed;
ALTER TABLE decision.decision
  ALTER COLUMN procedure SET NOT NULL,
  ADD FOREIGN KEY (procedure, rule) REFERENCES decision.procedure (id, rule);

CREATE TRIGGER procedure_kept BEFORE UPDATE OR DELETE ON decision.procedure
  FOR EACH ROW EXECUTE FUNCTION decision.procedure_kept();

GRANT SELECT ON decision.procedure TO cella_app, cella_rules;
