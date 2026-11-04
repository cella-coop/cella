-- A motion's requirements are the procedures on its mandate's chain,
-- never one the motion chooses. A procedure rides on a mandate, core's `circle.mandate.procedure`, and passes down the chain to
-- every mandate issued under it; each action a motion carries acts under
-- the collective mandate its circle holds for the action's power. This
-- feat holds the procedures and reads core's mandates, so it finds what a motion
-- is decided by and refuses a proposal decided by another.

-- What a mandate's chain asks: the nearest procedure stated on it, the
-- mandate's own or else its parent's chain's, or none.
CREATE FUNCTION motion.asks_of(mandate bigint) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT m.procedure
  FROM circle.chain(asks_of.mandate) c
  JOIN circle.mandate m ON m.id = c.id
  WHERE m.procedure IS NOT NULL
  ORDER BY c.depth DESC
  LIMIT 1;
END;

-- The requirements of a motion of `circle` carrying `actions`, as a
-- proposal lists them (`[{"kind": "end", "args": {"policy": …}}]`), on
-- `day`, each with why it is asked: for each action, what the chain of
-- the collective mandate its circle holds for the action's power asks,
-- the first standing by id; and for each policy it replaces or ends, the
-- procedure protecting it.
CREATE FUNCTION motion.requirements(circle text, actions jsonb, day date) RETURNS TABLE (procedure text, why text)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT q.procedure, q.why
  FROM (
    SELECT motion.asks_of(u.id) AS procedure,
           'the chain of mandate ' || u.id || ', for ' || c.power || ', asks it' AS why, a.n
    FROM jsonb_array_elements(coalesce(requirements.actions, '[]')) WITH ORDINALITY a(action, n)
    JOIN motion.carries k ON k.kind = a.action ->> 'kind'
    JOIN motion.cites c ON c.op = k.op
    CROSS JOIN LATERAL (
      SELECT m.id FROM circle.mandate m
      WHERE m.grantee = requirements.circle AND m.power = c.power
        AND m."from" <= requirements.day
        AND (m.until IS NULL OR m.until > requirements.day)
        AND (m.revoked IS NULL OR m.revoked > requirements.day)
      ORDER BY m.id
      LIMIT 1
    ) u
    UNION ALL
    SELECT r.protected, r.id || ' is protected by it', a.n
    FROM jsonb_array_elements(coalesce(requirements.actions, '[]')) WITH ORDINALITY a(action, n)
    JOIN policy.policy r ON r.id = CASE a.action ->> 'kind'
      WHEN 'policy' THEN a.action -> 'args' ->> 'replaces'
      WHEN 'end' THEN a.action -> 'args' ->> 'policy'
    END
    WHERE r.protected IS NOT NULL
  ) q
  WHERE q.procedure IS NOT NULL
  ORDER BY q.n, q.why;
END;

-- The procedure a motion of `circle` carrying `actions` is decided by on
-- `day`: the one of its requirements as strict as all the others, or the
-- circle's procedure where none asks one; none where no one of them
-- meets them all, as consent beside a majority.
CREATE FUNCTION motion.required(circle text, actions jsonb, day date) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (SELECT FROM motion.requirements(required.circle, required.actions, required.day))
      THEN (SELECT c.procedure FROM circle.circle c WHERE c.id = required.circle)
    ELSE (
      SELECT a.procedure
      FROM motion.requirements(required.circle, required.actions, required.day) a
      WHERE NOT EXISTS (
        SELECT FROM motion.requirements(required.circle, required.actions, required.day) b
        WHERE NOT motion.as_strict(a.procedure, b.procedure)
      )
      ORDER BY a.procedure
      LIMIT 1
    )
  END;
END;

-- motion:motion:propose — the motion is decided by the procedure its
-- requirements fix on the verdict date, whatever its proposal named.
CREATE FUNCTION motion.requires(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN q.required IS NULL
      THEN d.id || ' must be decided by each of its requirements, ' || q.asked || ', and no one procedure meets them all'
    WHEN q.required <> d.procedure
      THEN d.id || ' is decided by ' || d.procedure || ', but '
        || coalesce('its requirements ask ' || q.required || ': ' || q.asked, d.circle || ' decides by ' || q.required)
  END
  FROM motion.motion d
  CROSS JOIN LATERAL (
    SELECT coalesce(jsonb_agg(jsonb_build_object('kind', m.kind, 'args', m.args) ORDER BY m.n), '[]') AS actions
    FROM motion.action m
    WHERE m.motion = d.id
  ) a
  CROSS JOIN LATERAL (
    SELECT motion.required(d.circle, a.actions, cella.verdict_date()) AS required,
           (SELECT string_agg(r.procedure || ', as ' || r.why, '; ')
            FROM motion.requirements(d.circle, a.actions, cella.verdict_date()) r) AS asked
  ) q
  WHERE d.id = payload ->> 'motion';
END;

-- motion:policy:adopt — a mandate the adoption grants states, if any, a
-- procedure the motion feat holds, at least as strict as what its
-- parent's chain asks, so a procedure passes down the chain and no
-- mandate issued under it loosens it.
CREATE FUNCTION motion.passes_down(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (SELECT FROM motion.procedure o WHERE o.id = m.procedure)
      THEN 'mandate ' || m.id || ' asks ' || m.procedure || ', which is no procedure'
    WHEN motion.asks_of(m.parent) IS NOT NULL AND NOT motion.as_strict(m.procedure, motion.asks_of(m.parent))
      THEN 'mandate ' || m.id || ' asks ' || m.procedure || ', looser than ' || motion.asks_of(m.parent)
        || ', which the chain of mandate ' || m.parent || ' it is issued under asks'
  END
  FROM circle.mandate m
  WHERE m.policy = payload ->> 'policy' AND m.procedure IS NOT NULL;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'motion.requires(jsonb)', 'motion'),
  ('motion:policy:adopt', 'motion.passes_down(jsonb)', 'motion');
