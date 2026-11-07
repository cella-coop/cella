-- How a motion is taken: a procedure names its method, the stances it
-- counts; for a majority, the share of the votes cast it needs, at least
-- `share_num` in every `share_den` of those for and against, or with none
-- more for than against; and its quorum, how many of those counted must
-- give a stance, at least `quorum_num` in every `quorum_den`. Who votes,
-- who may veto and who is consulted are its parties, `motion.party`. A
-- motion is decided by the one its requirements fix, never one its
-- proposal names, and keeps it. Every procedure but the built-in ones is
-- a procedure policy's, its values copied here as it is adopted
-- (009-policy.sql).
CREATE TABLE motion.procedure (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z-]*$'),
  label text NOT NULL,
  method text NOT NULL CHECK (method IN ('consent', 'majority')),
  share_num integer,
  share_den integer,
  quorum_num integer NOT NULL DEFAULT 0,
  quorum_den integer NOT NULL DEFAULT 1,
  CHECK ((share_num IS NULL) = (share_den IS NULL)),
  CHECK (share_num IS NULL OR (method = 'majority' AND 0 < share_num AND share_num <= share_den)),
  CHECK (0 <= quorum_num AND quorum_num <= quorum_den),
  -- The procedure policy whose values these are, in the register; none
  -- for a built-in one its scope has not adopted.
  policy text UNIQUE,
  UNIQUE (id, method)
);

INSERT INTO motion.procedure (id, label, method, share_num, share_den) VALUES
  ('consent', 'Consent', 'consent', NULL, NULL),
  ('majority', 'Majority', 'majority', NULL, NULL),
  ('two-thirds', 'Two thirds', 'majority', 2, 3);

-- A procedure a motion was taken under is fixed: its terms are what the
-- motion's stances were counted by. A built-in one may come to name the
-- policy that adopts it, its terms unchanged.
CREATE FUNCTION motion.procedure_kept() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.policy IS NULL AND (to_jsonb(NEW) - 'policy') = (to_jsonb(OLD) - 'policy') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT FROM motion.motion d WHERE d.procedure = OLD.id) THEN
    RAISE EXCEPTION 'motions are taken by %: its terms are fixed', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

-- Each motion names its procedure, whose method is its own. The motions
-- before procedures were taken by the procedure of their method's name.
ALTER TABLE motion.motion ADD COLUMN procedure text;
ALTER TABLE motion.motion DISABLE TRIGGER stays_closed;
UPDATE motion.motion SET procedure = method;
ALTER TABLE motion.motion ENABLE TRIGGER stays_closed;
ALTER TABLE motion.motion
  ALTER COLUMN procedure SET NOT NULL,
  ADD FOREIGN KEY (procedure, method) REFERENCES motion.procedure (id, method);

CREATE TRIGGER procedure_kept BEFORE UPDATE OR DELETE ON motion.procedure
  FOR EACH ROW EXECUTE FUNCTION motion.procedure_kept();

-- A procedure's parties, each a grantee by one key into core's
-- `circle.grantee`, the key a mandate's recipient is, and its kind:
-- `votes`, a role whose seats in the motion's circle vote, none for every
-- seat; `vetoes`, a role whose seats on the roll may veto, which the
-- graft that fixes the roll reads; `consulted`, the circle whose seats
-- must have spoken on a motion before it closes, one at most. Only a
-- procedure policy's adoption makes them, with its procedure
-- (009-policy.sql); the built-in procedures have none.
CREATE TABLE motion.party (
  procedure text NOT NULL REFERENCES motion.procedure ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('votes', 'vetoes', 'consulted')),
  grantee text NOT NULL REFERENCES circle.grantee,
  PRIMARY KEY (procedure, kind, grantee)
);

CREATE UNIQUE INDEX one_consulted ON motion.party (procedure) WHERE kind = 'consulted';

-- A procedure's parties are fixed with its terms: once a motion is
-- taken under it, none is added, changed or taken away.
CREATE FUNCTION motion.party_kept() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM motion.motion d WHERE d.procedure = coalesce(OLD.procedure, NEW.procedure)) THEN
    RAISE EXCEPTION 'motions are taken by %: its parties are fixed', coalesce(OLD.procedure, NEW.procedure)
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

CREATE TRIGGER party_kept BEFORE INSERT OR UPDATE OR DELETE ON motion.party
  FOR EACH ROW EXECUTE FUNCTION motion.party_kept();

GRANT SELECT ON motion.party TO cella_app, cella_guards;

COMMENT ON TABLE motion.party IS 'registry: the parties each procedure policy adopted names, copied from the register with its procedure';

GRANT SELECT ON motion.procedure TO cella_app, cella_guards;

COMMENT ON TABLE motion.procedure IS 'registry: the built-in procedures and the values each procedure policy adopted fixes, copied from the register, where the policy names its circle';
