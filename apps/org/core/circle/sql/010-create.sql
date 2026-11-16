-- A circle is created by motion, `circle:circle:create`, with its id,
-- name and purpose, beside every other and inside none: never the
-- assembly, which the founding makes. It holds the default bundle from
-- the day it is created, with no further motion.

-- The default bundle on a day: every mandate in force then on a role
-- every circle has (`*`), the participant's, the lead's, the
-- secretary's, by id. Each is a mandate policy of the assembly, so a
-- co-op changes the template by motion; one scoped `own` covers, for each
-- holder, the circle they hold the role in, the new one among them. The
-- creation's entry names it, so the log says what a circle was created
-- with.
CREATE FUNCTION circle.bundle(day date) RETURNS bigint[]
LANGUAGE sql STABLE
RETURN ARRAY(
  SELECT m.id
  FROM circle.mandate m
  JOIN circle.role r ON r.id = m.grantee AND r.circle = '*'
  WHERE m."from" <= bundle.day
    AND (m.until IS NULL OR m.until > bundle.day)
    AND (m.revoked IS NULL OR m.revoked > bundle.day)
  ORDER BY m.id
);

-- The app makes a circle's grantee with it, through the trigger, and
-- never one by hand.
ALTER FUNCTION circle.granted_to() SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
REVOKE EXECUTE ON FUNCTION circle.granted_to() FROM PUBLIC;

GRANT INSERT (id, name, purpose) ON circle.circle TO cella_app;

-- A circle is amended by motion, `circle:circle:amend`: its name, its
-- purpose or its procedure, from the verdict date, its id never, so
-- every record, mandate and seat it owns stays its own.
GRANT UPDATE (name, purpose, procedure) ON circle.circle TO cella_app;

-- A role is made by motion, `circle:role:make`, in a circle or in every
-- working circle (`*`), with its name, duty and cap, its id taken from
-- its name as it is made (`circle.role_key`); and amended by
-- motion, `circle:role:amend`, its name, duty or cap, from the verdict
-- date, its id and circle never, so its tenures and mandates stay its own.
-- The app makes a role's grantee with it, through the trigger.
GRANT INSERT (id, circle, name, duty, holders) ON circle.role TO cella_app;
GRANT UPDATE (name, duty, holders) ON circle.role TO cella_app;

-- The key a name gives a role: in lower case, its accents dropped, each
-- run of anything but a letter or a digit one hyphen, from its first
-- letter, as `print-buyer` from Print buyer; `role` where it has none.
CREATE FUNCTION circle.keyed(name text) RETURNS text
LANGUAGE sql IMMUTABLE
RETURN coalesce(nullif(regexp_replace(regexp_replace(
  regexp_replace(lower(normalize(coalesce(keyed.name, ''), NFD)), '[^a-z0-9]+', '-', 'g'),
  '^[^a-z]+', ''), '-+$', ''), ''), 'role');

-- The id a role named `name` takes as it is made: its key
-- (`circle.keyed`), with `-2`, `-3` and on after it where a circle or a
-- role already holds that key, since circles and roles share one.
CREATE FUNCTION circle.role_key(name text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT k.id FROM (
    SELECT n, CASE n WHEN 1 THEN circle.keyed(role_key.name) ELSE circle.keyed(role_key.name) || '-' || n END AS id
    FROM generate_series(1, (SELECT count(*)::int FROM circle.grantee) + 1) n
  ) k
  WHERE NOT EXISTS (SELECT FROM circle.grantee g WHERE g.id = k.id)
  ORDER BY k.n
  LIMIT 1;
END;
