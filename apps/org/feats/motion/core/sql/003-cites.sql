-- The actions that cite a motion: each settles only once the motion it
-- names in its payload's `motion` has closed and passed. A graft that
-- joins this feat to the action's feat registers it here by
-- motion.register_cite; the graft that can count a motion's roll
-- registers the guard that checks it by motion.register_cite_guard, and
-- these functions attach that guard to every action listed, whichever
-- came first, so neither graft needs to know the other.
CREATE TABLE motion.cites (
  op text PRIMARY KEY,
  owner text NOT NULL
);

-- The guards that cover every action listed in motion.cites.
CREATE TABLE motion.cite_guard (
  fn regprocedure PRIMARY KEY,
  owner text NOT NULL
);

-- Lists an action as citing a motion, and attaches to it every guard
-- registered as covering them all. A graft's migration calls it, and
-- never inserts into motion.cites itself.
CREATE FUNCTION motion.register_cite(action text, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO motion.cites (op, owner) VALUES (register_cite.action, register_cite.owner);
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

REVOKE EXECUTE ON FUNCTION motion.register_cite(text, text), motion.register_cite_guard(regprocedure, text) FROM PUBLIC;

GRANT SELECT ON motion.cites, motion.cite_guard TO cella_app, cella_guards;
