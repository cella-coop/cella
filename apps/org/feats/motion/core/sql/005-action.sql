-- The kinds of thing a motion can decide beyond its text, each
-- registered by the graft that carries it out: admitting a member,
-- nesting a circle. `fields` names the arguments an action of the kind
-- takes, as the New form asks for them: [{ name, label, type, optional }],
-- type `text` or `number`. This feat knows no kind; it keeps the register, as
-- it keeps `motion.cites`, and motion.register_carries alone writes it.
CREATE TABLE motion.carries (
  kind text PRIMARY KEY CHECK (kind ~ '^[a-z][a-z-]*$'),
  label text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(fields) = 'array'),
  owner text NOT NULL
);

-- Registers a kind of action a motion can carry, with the arguments its
-- New form asks for. A graft's migration calls it, and never inserts into
-- motion.carries itself.
CREATE FUNCTION motion.register_carries(action text, label text, fields jsonb, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO motion.carries (kind, label, fields, owner)
  VALUES (register_carries.action, register_carries.label, register_carries.fields, register_carries.owner);
END;

REVOKE EXECUTE ON FUNCTION motion.register_carries(text, text, jsonb, text) FROM PUBLIC;

-- What a motion decides, in the order proposed: an action of a
-- registered kind and its arguments, which the kind's graft reads and its
-- guards check. Actions are fixed with the proposal.
CREATE TABLE motion.action (
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
