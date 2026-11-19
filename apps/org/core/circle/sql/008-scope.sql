-- Whether a mandate's scope covers a record's owning circle `about`: a
-- mandate marking none covers the whole coop, every circle's records;
-- one on a circle that circle's alone; one on `own` those of the circle
-- `held`, where its holder holds the role. A scope is a condition on the
-- permission, never a place in a tree, and ownership grants nothing by
-- itself: this says only whether a mandate someone holds reaches a
-- record. `about` null is a question asked of no record, as reading asks
-- until it follows the mandates, which any mandate answers.
CREATE FUNCTION circle.covers(scope text, held text, about text) RETURNS boolean
LANGUAGE sql IMMUTABLE
RETURN covers.about IS NULL OR covers.scope IS NULL OR covers.scope = covers.about
  OR (covers.scope = 'own' AND covers.held = covers.about);
