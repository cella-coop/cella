-- A mandate is carved from what the circle above holds: a mandate in
-- force of a circle, on one of its roles or on the circle itself, is
-- within the mandates for the same power of the nearest circle above it
-- that holds that power by a mandate, on its roles or on itself. Within
-- means one of them is uncapped, or caps a write by a limit at least the
-- mandate's, or a budget over the same period at least the mandate's. A
-- power no circle above holds by a mandate is the assembly's, which
-- holds every power inherently, so it caps nothing; a role every working
-- circle has (`*`) and a right are the assembly's to grant, and are neither
-- carved nor carved from.
--
-- Each mandate in force on `day` with the circle it is of: its role's,
-- or the circle a collective mandate is on; none for a right.
CREATE FUNCTION circle.held(day date) RETURNS TABLE (
  id bigint, circle text, power text, "limit" cella.amount, budget cella.amount, per text
)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT m.id, coalesce(m.circle, r.circle), m.power, m."limit", m.budget, m.per
  FROM circle.mandate m
  LEFT JOIN circle.role r ON r.id = m.role
  WHERE (m.revoked IS NULL OR m.revoked > held.day)
    AND (m."from" IS NULL OR m."from" <= held.day)
    AND (m.until IS NULL OR m.until > held.day);
END;

-- The first mandate in force on `day` that is not so carved, as a reason,
-- or NULL when every one is.
CREATE FUNCTION circle.beyond(day date) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'mandate ' || m.id || ' grants ' || m.power || ' to ' || coalesce(o.role, o.circle)
    || ' beyond what ' || s.circle || ' holds of it'
  FROM circle.held(beyond.day) m
  JOIN circle.mandate o ON o.id = m.id
  JOIN circle.circle c ON c.id = m.circle
  JOIN LATERAL (
    SELECT x.circle
    FROM circle.held(beyond.day) x
    WHERE x.power = m.power
      AND x.circle = ANY(c.path)
      AND x.circle <> c.id
    ORDER BY array_position(c.path, x.circle) DESC
    LIMIT 1
  ) s ON true
  WHERE NOT EXISTS (
    SELECT FROM circle.held(beyond.day) y
    WHERE y.circle = s.circle
      AND y.power = m.power
      AND ((y."limit" IS NULL AND y.budget IS NULL)
        OR cella.cents(m."limit") <= cella.cents(y."limit")
        OR (m.per = y.per AND cella.cents(m.budget) <= cella.cents(y.budget)))
  )
  ORDER BY m.id
  LIMIT 1;
END;

-- circle:circle:nest, and the adoption and end of a mandate policy, to
-- which circle-motion attaches it — after the write, every mandate in
-- force is carved from what the circle above holds: a grant beyond its
-- source is refused, as is an end that leaves a mandate carved from it
-- beyond what remains above, and a nesting that moves a subtree under
-- circles holding less than its mandates.
CREATE FUNCTION circle.carves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.beyond(cella.verdict_date());
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('circle:circle:nest', 'circle.carves(jsonb)', 'circle');
