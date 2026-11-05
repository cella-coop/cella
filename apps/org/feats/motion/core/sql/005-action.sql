-- The kinds of thing a motion can decide beyond its text, each
-- registered by the graft that carries it out: admitting a member,
-- nesting a circle. `fields` names the arguments an action of the kind
-- takes, as the New form asks for them: [{ name, label, type, optional }],
-- type `text` or `number`; `op`, the action that carries it out, whose
-- power in `motion.cites` the motion's circle must hold to propose it.
-- This feat knows no kind; it keeps the register, as it keeps
-- `motion.cites`, and motion.register_carries alone writes it.
CREATE TABLE motion.carries (
  kind text PRIMARY KEY CHECK (kind ~ '^[a-z][a-z-]*$'),
  label text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(fields) = 'array'),
  op text NOT NULL CHECK (op ~ '^[a-z][a-z-]*:[a-z][a-z-]*:[a-z][a-z-]*$'),
  owner text NOT NULL
);

-- Registers a kind of action a motion can carry, with the arguments its
-- New form asks for and the action that carries it out. A graft's
-- migration calls it, and never inserts into motion.carries itself.
CREATE FUNCTION motion.register_carries(action text, label text, fields jsonb, op text, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO motion.carries (kind, label, fields, op, owner)
  VALUES (register_carries.action, register_carries.label, register_carries.fields, register_carries.op, register_carries.owner);
END;

REVOKE EXECUTE ON FUNCTION motion.register_carries(text, text, jsonb, text, text) FROM PUBLIC;

-- What a motion decides, in the order proposed: an action of a
-- registered kind and its arguments, which the kind's graft reads and its
-- guards check. Actions are fixed with the proposal.
CREATE TABLE motion.action (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  motion text NOT NULL REFERENCES motion.motion,
  n integer NOT NULL CHECK (n > 0),
  kind text NOT NULL REFERENCES motion.carries,
  args jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(args) = 'object'),
  PRIMARY KEY (motion, n)
);

CREATE INDEX ON motion.action (kind);

-- An action is part of the proposal: none is added once a stance is given
-- or the motion closed, so no one consents to one thing and is counted
-- for another.
CREATE FUNCTION motion.moved_with_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM motion.motion d WHERE d.id = NEW.motion AND d.closed IS NOT NULL)
    OR EXISTS (SELECT FROM motion.vote v WHERE v.motion = NEW.motion) THEN
    RAISE EXCEPTION '% has stances or is closed: what it decides is fixed', NEW.motion
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER moved_with_proposal BEFORE INSERT ON motion.action
  FOR EACH ROW EXECUTE FUNCTION motion.moved_with_proposal();

-- motion:motion:propose — the write proposed the motion on the
-- verdict date, open until a later deadline, with the actions its payload
-- names and no others.
CREATE FUNCTION motion.proposes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.id, 'is named')
    WHEN d.proposed IS DISTINCT FROM cella.verdict_date() OR d.closed IS NOT NULL
      THEN d.id || ' was not proposed by this write'
    WHEN d.deadline <= d.proposed THEN d.id || '''s deadline must come after ' || to_char(d.proposed, 'YYYY-MM-DD')
    WHEN (SELECT count(*) FROM motion.action m WHERE m.motion = d.id)
      <> jsonb_array_length(coalesce(p.actions, '[]'))
      THEN d.id || ' decides otherwise than its payload names'
  END
  FROM (SELECT payload ->> 'motion' AS id, payload -> 'actions' AS actions) p
  LEFT JOIN motion.motion d ON d.id = p.id;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:propose', 'motion.proposes(jsonb)', 'motion');

GRANT SELECT ON motion.carries TO cella_app, cella_guards;
GRANT SELECT, INSERT ON motion.action TO cella_app;
GRANT SELECT ON motion.action TO cella_guards;

COMMENT ON TABLE motion.carries IS 'registry: the kinds of action a motion carries, as the grafts register them';

-- The actions of other feats that put a motion in their own write, as
-- an application puts the motion to admit its applicant, each registered
-- by the graft that composes it; and the guards judging what a motion
-- asks however it is put, each attached to motion:motion:propose and to
-- every action listed, whichever came first, so neither graft needs to
-- know the other. Such a guard reads the motion its payload's `motion`
-- names.
CREATE TABLE motion.puts (
  op text PRIMARY KEY CHECK (op ~ '^[a-z][a-z-]*:[a-z][a-z-]*:[a-z][a-z-]*$'),
  owner text NOT NULL
);

CREATE TABLE motion.ask_guard (
  fn regprocedure PRIMARY KEY,
  owner text NOT NULL
);

-- Lists an action as putting a motion, and attaches to it every guard
-- registered as judging what a motion asks. A graft's migration calls
-- it, and never inserts into motion.puts itself.
CREATE FUNCTION motion.register_put(action text, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO motion.puts (op, owner) VALUES (register_put.action, register_put.owner);
  INSERT INTO cella.guard (op, fn, owner)
  SELECT register_put.action, g.fn, g.owner FROM motion.ask_guard g;
END;

-- Registers a guard judging what a motion asks, and attaches it to
-- motion:motion:propose and to each action listed as putting one so far;
-- motion.register_put attaches it to each listed after.
CREATE FUNCTION motion.register_ask_guard(fn regprocedure, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO motion.ask_guard (fn, owner) VALUES (register_ask_guard.fn, register_ask_guard.owner);
  INSERT INTO cella.guard (op, fn, owner)
  SELECT o.op, register_ask_guard.fn, register_ask_guard.owner
  FROM (SELECT 'motion:motion:propose' AS op UNION ALL SELECT p.op FROM motion.puts p) o;
END;

REVOKE EXECUTE ON FUNCTION motion.register_put(text, text), motion.register_ask_guard(regprocedure, text) FROM PUBLIC;

GRANT SELECT ON motion.puts, motion.ask_guard TO cella_app, cella_guards;

COMMENT ON TABLE motion.puts IS 'registry: the actions of other feats that put a motion in their own write, as the grafts register them';

COMMENT ON TABLE motion.ask_guard IS 'registry: the guards judging what a motion asks however it is put, as the grafts register them';
