-- The writes that cite a motion: each settles only once the motion it
-- names in its payload's `motion` has closed and passed. A graft that
-- joins this feat to the write's feat declares its op here; the graft that
-- can count a motion's roll registers the guard that checks it, for every
-- op listed, so neither needs to know the other.
CREATE TABLE motion.cites (
  op text PRIMARY KEY,
  owner text NOT NULL
);

GRANT SELECT ON motion.cites TO cella_app, cella_guards;
