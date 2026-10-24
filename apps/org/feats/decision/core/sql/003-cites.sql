-- The writes that cite a decision: each settles only once the decision it
-- names in its payload's `decision` has closed and passed. A graft that
-- joins this feat to the write's feat declares its op here; the graft that
-- can count a decision's roll registers the rule that checks it, for every
-- op listed, so neither needs to know the other.
CREATE TABLE decision.cites (
  op text PRIMARY KEY,
  owner text NOT NULL
);

GRANT SELECT ON decision.cites TO cella_app, cella_rules;
