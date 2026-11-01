-- Each circle's place in the tree: its ancestors from the assembly down,
-- itself last, kept by the triggers below, so a guard asks whether one
-- circle is within another without recursion.
ALTER TABLE circle.circle ADD COLUMN path text[];

WITH RECURSIVE tree AS (
  SELECT c.id, ARRAY[c.id] AS path FROM circle.circle c WHERE c.parent IS NULL
  UNION ALL
  SELECT c.id, t.path || c.id FROM circle.circle c JOIN tree t ON c.parent = t.id
)
UPDATE circle.circle c SET path = t.path FROM tree t WHERE t.id = c.id;

ALTER TABLE circle.circle ALTER COLUMN path SET NOT NULL;

-- One tree, one root: the assembly.
CREATE UNIQUE INDEX one_root ON circle.circle ((true)) WHERE parent IS NULL;

-- A circle's path follows its parent's; nesting a circle under itself or
-- under one within it is refused, whatever wrote it.
CREATE FUNCTION circle.placed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  above text[];
BEGIN
  IF NEW.parent IS NULL THEN
    NEW.path := ARRAY[NEW.id];
    RETURN NEW;
  END IF;
  SELECT p.path INTO above FROM circle.circle p WHERE p.id = NEW.parent;
  IF above IS NULL THEN
    RAISE EXCEPTION 'no circle %', NEW.parent USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NEW.id = ANY(above) THEN
    RAISE EXCEPTION '% is within %: nesting it there makes a cycle', NEW.parent, NEW.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  NEW.path := above || NEW.id;
  RETURN NEW;
END
$$;

CREATE TRIGGER placed BEFORE INSERT OR UPDATE OF parent ON circle.circle
  FOR EACH ROW EXECUTE FUNCTION circle.placed();

-- A moved circle carries its subtree: each circle within it takes the new
-- path above the moved one.
CREATE FUNCTION circle.carried() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE circle.circle c SET path = NEW.path || c.path[array_position(c.path, NEW.id) + 1:]
  WHERE NEW.id = ANY(c.path) AND c.id <> NEW.id;
  RETURN NULL;
END
$$;

CREATE TRIGGER carried AFTER UPDATE OF parent ON circle.circle
  FOR EACH ROW WHEN (OLD.parent IS DISTINCT FROM NEW.parent)
  EXECUTE FUNCTION circle.carried();

-- Whether the circle `part` is within the circle `whole`, or is it.
CREATE FUNCTION circle.within(part text, whole text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (SELECT FROM circle.circle c WHERE c.id = within.part AND within.whole = ANY(c.path));
END;

-- A revoked mandate stays revoked, and a mandate's grant never changes.
CREATE FUNCTION circle.stays_granted() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.role, NEW.circle, NEW."right", NEW.power, NEW.policy, cella.cents(NEW."limit"), cella.cents(NEW.budget), NEW.per, NEW."from", NEW.until)
       IS DISTINCT FROM (OLD.role, OLD.circle, OLD."right", OLD.power, OLD.policy, cella.cents(OLD."limit"), cella.cents(OLD.budget), OLD.per, OLD."from", OLD.until)
    OR (OLD.revoked IS NOT NULL AND NEW.revoked IS DISTINCT FROM OLD.revoked) THEN
    RAISE EXCEPTION 'mandate % of % keeps its grant, and stays revoked', OLD.id, coalesce(OLD.role, OLD.circle, OLD."right")
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_granted BEFORE UPDATE ON circle.mandate
  FOR EACH ROW EXECUTE FUNCTION circle.stays_granted();

-- circle:circle:nest — the circle sits under the parent the payload
-- names, and its path is its parent's as it stands under the log's lock:
-- a nesting that settled first and put the parent within this circle
-- makes this one a cycle, refused here though each saw none alone.
CREATE FUNCTION circle.nests(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no circle ' || coalesce(p.circle, 'is named')
    WHEN up.id IS NULL THEN 'no circle ' || coalesce(p.parent, 'is named') || ' to nest under'
    WHEN c.parent IS DISTINCT FROM up.id THEN c.id || ' was not nested under ' || up.id || ' by this write'
    WHEN c.id = ANY(up.path) THEN up.id || ' is within ' || c.id || ': nesting it there makes a cycle'
    WHEN c.path IS DISTINCT FROM up.path || c.id THEN c.id || ' moved under a parent that moved meanwhile'
  END
  FROM (SELECT payload ->> 'circle' AS circle, payload ->> 'parent' AS parent) p
  LEFT JOIN circle.circle c ON c.id = p.circle
  LEFT JOIN circle.circle up ON up.id = p.parent;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('circle:circle:nest', 'circle.nests(jsonb)', 'circle');

GRANT UPDATE (parent, path) ON circle.circle TO cella_app;
GRANT INSERT, UPDATE (revoked) ON circle.mandate TO cella_app;
