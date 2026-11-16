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
-- its name at the proposal (`circle.role_key`); and amended by
-- motion, `circle:role:amend`, its name, duty or cap, from the verdict
-- date, its id and circle never, so its tenures and mandates stay its own.
-- The app makes a role's grantee with it, through the trigger.
GRANT INSERT (id, circle, name, duty, holders) ON circle.role TO cella_app;
GRANT UPDATE (name, duty, holders) ON circle.role TO cella_app;

-- The key a name gives a role: in lower case, its accents dropped (é as
-- e) and the letters with no accent to drop spelt out (ø as o, æ as ae,
-- œ as oe, ß as ss, ł as l, đ as d, þ as th), each run of anything but a
-- letter or a digit one hyphen, from its first letter, as `tresorier` from
-- Trésorier; `role` where it has none.
CREATE FUNCTION circle.keyed(name text) RETURNS text
LANGUAGE sql IMMUTABLE
RETURN coalesce(nullif(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
  normalize(translate(replace(replace(replace(replace(lower(coalesce(keyed.name, '')), 'æ', 'ae'), 'œ', 'oe'), 'ß', 'ss'), 'þ', 'th'), 'øłđ', 'old'), NFD),
  '[̀-ͯ]', '', 'g'), '[^a-z0-9]+', '-', 'g'), '^[^a-z]+', ''), '-+$', ''), ''), 'role');

-- The id a role named `name` takes: its key (`circle.keyed`), with `-2`,
-- `-3` and on after it where a circle or a role already holds that key,
-- since circles and roles share one, or where `taken` names it, as a
-- motion's earlier actions make. A motion's proposal gives each role it
-- makes its id so, and the make takes the id given. It runs as its
-- owner, so a proposer who reads only part of the structure is given the
-- id the guard, which reads it whole, asks; it tells them only whether
-- an id is held.
CREATE FUNCTION circle.role_key(name text, taken text[] DEFAULT '{}') RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT k.id FROM (
    SELECT n, CASE n WHEN 1 THEN circle.keyed(role_key.name) ELSE circle.keyed(role_key.name) || '-' || n END AS id
    FROM generate_series(1, (SELECT count(*)::int FROM circle.grantee) + coalesce(cardinality(role_key.taken), 0) + 1) n
  ) k
  WHERE NOT EXISTS (SELECT FROM circle.grantee g WHERE g.id = k.id) AND NOT (k.id = ANY (coalesce(role_key.taken, '{}')))
  ORDER BY k.n
  LIMIT 1;
END;
REVOKE EXECUTE ON FUNCTION circle.role_key(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION circle.role_key(text, text[]) TO cella_app, cella_guards;

-- Refuses a new role's id where a circle or a role holds it already, as
-- one made since the motion gave it, saying which: the make never takes
-- another in its place.
CREATE FUNCTION circle.free(id text) RETURNS void
LANGUAGE plpgsql STABLE AS $$
DECLARE
  held text := (SELECT g.kind FROM circle.grantee g WHERE g.id = free.id);
BEGIN
  IF held IS NOT NULL THEN
    RAISE EXCEPTION 'a % % is there already, made since the motion gave the new role that id: propose the role again for another', held, free.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
END
$$;
