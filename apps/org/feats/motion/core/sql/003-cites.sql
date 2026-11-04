-- The actions that cite a motion: each settles only once the motion it
-- names in its payload's `motion` has closed and passed, and only where
-- the motion's circle holds a collective mandate for its `power`. A
-- graft that joins this feat to the action's feat registers it here by
-- motion.register_cite, with that power; an action listed here is in no
-- `cella.power`, so no seat's mandate allows it. The grafts that can
-- judge a cited write register their guards by
-- motion.register_cite_guard (the roll's count, the circle's collective
-- mandate), and these functions attach each to every action listed,
-- whichever came first, so neither graft needs to know the other.
CREATE TABLE motion.cites (
  op text PRIMARY KEY,
  power text NOT NULL CHECK (power ~ '^[a-z][a-z-]*$'),
  owner text NOT NULL
);

-- The guards that cover every action listed in motion.cites.
CREATE TABLE motion.cite_guard (
  fn regprocedure PRIMARY KEY,
  owner text NOT NULL
);

-- Lists an action as citing a motion, with the power a collective
-- mandate grants it, and attaches to it every guard registered as
-- covering them all. A graft's migration calls it, and never inserts into
-- motion.cites itself.
CREATE FUNCTION motion.register_cite(action text, power text, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO motion.cites (op, power, owner) VALUES (register_cite.action, register_cite.power, register_cite.owner);
  INSERT INTO cella.guard (op, fn, owner)
  SELECT register_cite.action, g.fn, g.owner FROM motion.cite_guard g;
END;

-- Registers a guard that covers every action citing a motion, and
-- attaches it to each action listed so far; motion.register_cite
-- attaches it to each listed after.
CREATE FUNCTION motion.register_cite_guard(fn regprocedure, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO motion.cite_guard (fn, owner) VALUES (register_cite_guard.fn, register_cite_guard.owner);
  INSERT INTO cella.guard (op, fn, owner)
  SELECT c.op, register_cite_guard.fn, register_cite_guard.owner FROM motion.cites c;
END;

REVOKE EXECUTE ON FUNCTION motion.register_cite(text, text, text), motion.register_cite_guard(regprocedure, text) FROM PUBLIC;

GRANT SELECT ON motion.cites, motion.cite_guard TO cella_app, cella_guards;

COMMENT ON TABLE motion.cites IS 'registry: the actions that cite a motion, as the grafts register them';

COMMENT ON TABLE motion.cite_guard IS 'registry: the guards covering every action that cites a motion, as the grafts register them';
