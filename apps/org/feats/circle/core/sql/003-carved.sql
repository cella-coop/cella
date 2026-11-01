-- A mandate is carved from what the circle above holds: a mandate in
-- force on a role of a circle is within the mandates for the same power
-- on the roles of the nearest circle above it that holds that power by a
-- mandate. Within means one of them is uncapped, or caps a write by a
-- limit at least the mandate's, or a budget over the same period at least
-- the mandate's. A power no circle above holds by a mandate is the
-- assembly's, which holds every power inherently, so it caps nothing; a
-- role every working circle has (`*`) is the assembly's to grant, and is
-- neither carved nor carved from.
--
-- The first mandate in force on `day` that is not so carved, as a reason,
-- or NULL when every one is.
CREATE FUNCTION circle.beyond(day date) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'mandate ' || m.id || ' grants ' || m.power || ' to ' || m.role || ' beyond what ' || s.circle || ' holds of it'
  FROM circle.mandate m
  JOIN circle.role r ON r.id = m.role
  JOIN circle.circle c ON c.id = r.circle
  JOIN LATERAL (
    SELECT r2.circle
    FROM circle.mandate x
    JOIN circle.role r2 ON r2.id = x.role
    WHERE x.power = m.power
      AND x.revoked IS NULL
      AND (x."from" IS NULL OR x."from" <= beyond.day)
      AND (x.until IS NULL OR x.until > beyond.day)
      AND r2.circle = ANY(c.path)
      AND r2.circle <> c.id
    ORDER BY array_position(c.path, r2.circle) DESC
    LIMIT 1
  ) s ON true
  WHERE m.revoked IS NULL
    AND (m."from" IS NULL OR m."from" <= beyond.day)
    AND (m.until IS NULL OR m.until > beyond.day)
    AND NOT EXISTS (
      SELECT FROM circle.mandate y
      JOIN circle.role r3 ON r3.id = y.role
      WHERE r3.circle = s.circle
        AND y.power = m.power
        AND y.revoked IS NULL
        AND (y."from" IS NULL OR y."from" <= beyond.day)
        AND (y.until IS NULL OR y.until > beyond.day)
        AND ((y."limit" IS NULL AND y.budget IS NULL)
          OR cella.cents(m."limit") <= cella.cents(y."limit")
          OR (m.per = y.per AND cella.cents(m.budget) <= cella.cents(y.budget)))
    )
  ORDER BY m.id
  LIMIT 1;
END;

-- circle:mandate:grant, circle:mandate:revoke, circle:circle:nest — after
-- the write, every mandate in force is carved from what the circle above
-- holds: a grant beyond its source is refused, as is a revocation that
-- leaves a mandate carved from it beyond what remains above, and a
-- nesting that moves a subtree under circles holding less than its
-- mandates.
CREATE FUNCTION circle.carves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.beyond(cella.verdict_date());
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('circle:circle:nest', 'circle.carves(jsonb)', 'circle'),
  ('circle:mandate:grant', 'circle.carves(jsonb)', 'circle'),
  ('circle:mandate:revoke', 'circle.carves(jsonb)', 'circle');
