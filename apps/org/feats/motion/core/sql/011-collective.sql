-- A circle uses a collective mandate only by motion: an action a passed
-- motion carries takes effect only where the motion's circle holds a
-- collective mandate for the action's power (`circle.holds`), the power
-- the action's graft registered with it in `motion.cites`. This feat
-- reads core's mandates, so it checks it twice: at the proposal, for every
-- action the motion carries, and at each write that carries one out.

-- motion:motion:propose — the motion's circle holds, on the verdict
-- date, a collective mandate for the power of every action it carries:
-- the power `motion.cites` lists for the action that carries out its
-- kind.
CREATE FUNCTION motion.empowers(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.power IS NULL THEN k.kind || ' is carried out by ' || k.op || ', which names no power in motion.cites'
    ELSE d.circle || ' holds no collective mandate for ' || c.power || ', so its motion may not ' || lower(k.label)
  END
  FROM motion.action m
  JOIN motion.motion d ON d.id = m.motion
  JOIN motion.carries k ON k.kind = m.kind
  LEFT JOIN motion.cites c ON c.op = k.op
  WHERE m.motion = payload ->> 'motion'
    AND (c.power IS NULL OR NOT circle.holds(d.circle, c.power, cella.verdict_date()))
  ORDER BY m.n
  LIMIT 1;
END;

-- Every write in motion.cites — the cited motion's circle holds, on the
-- verdict date, a collective mandate for the power the write is listed
-- with, so a mandate revoked between the proposal and the close carries
-- nothing.
CREATE FUNCTION motion.mandated(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(payload ->> 'motion', 'is cited')
    WHEN NOT circle.holds(d.circle, c.power, cella.verdict_date())
      THEN d.circle || ' holds no collective mandate for ' || c.power || ', which ' || c.op || ' needs'
  END
  FROM motion.cites c
  LEFT JOIN motion.motion d ON d.id = payload ->> 'motion'
  WHERE c.op = cella.action();
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'motion.empowers(jsonb)', 'motion');

-- The guard covers every action that cites a motion: the motion feat
-- attaches it to those registered before this file migrated,
-- and to any they register after.
SELECT motion.register_cite_guard('motion.mandated(jsonb)', 'motion');
