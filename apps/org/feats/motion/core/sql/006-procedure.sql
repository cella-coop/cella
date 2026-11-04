-- How a motion is taken: a procedure names its method, the stances it
-- counts; for a majority, the share of the votes cast it needs, at least
-- `share_num` in every `share_den` of those for and against, or with none
-- more for than against; and its quorum, how many of those counted must
-- give a stance, at least `quorum_num` in every `quorum_den`; the roles
-- whose seats vote, `voters`, none for every seat, and those that may
-- veto, `veto`, by id, which the graft that fixes the roll reads; and
-- the circle it consults, `consult`, by id, whose seats must have spoken
-- on a motion before it closes. A motion is decided by the one its
-- requirements fix, never one its proposal names, and keeps it. Every procedure but the built-in ones is
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
  voters text[] CHECK (cardinality(voters) > 0),
  veto text[] NOT NULL DEFAULT '{}',
  consult text CHECK (consult ~ '^[a-z][a-z0-9-]*$'),
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

GRANT SELECT ON motion.procedure TO cella_app, cella_guards;

COMMENT ON TABLE motion.procedure IS 'registry: the built-in procedures and the values each procedure policy adopted fixes, copied from the register, where the policy names its circle';
