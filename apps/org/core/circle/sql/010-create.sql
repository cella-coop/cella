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
-- working circle (`*`), with its id, name, duty and cap; and amended by
-- motion, `circle:role:amend`, its name, duty or cap, from the verdict
-- date, its id and circle never, so its tenures and mandates stay its own.
-- The app makes a role's grantee with it, through the trigger.
GRANT INSERT (id, circle, name, duty, holders) ON circle.role TO cella_app;
GRANT UPDATE (name, duty, holders) ON circle.role TO cella_app;
