-- The policy register: every policy a circle adopted by motion, its kind,
-- its wordings, the values marked in its legal wording, the motion and
-- the action of it that adopted it, the day it applies from and the day
-- it ends, the policy it replaces and the action that ended it. A core
-- library's, beside the notary: it knows no feat, so a motion is named by
-- its id and no foreign key leaves the schema. Only `policy.adopt` and `policy.end` write it,
-- inside a write a motion carries; every slice reads its policies and
-- values, and only the app reads the wording, which no guard reads.
CREATE SCHEMA policy;

-- A policy's id is the action that adopted it: its motion and its number
-- there, `m-2026-013/1`.
CREATE TABLE policy.policy (
  id text PRIMARY KEY,
  circle text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('mandate', 'rule', 'procedure')),
  motion text NOT NULL,
  n integer NOT NULL CHECK (n > 0),
  -- What the motion adopted: the BLAKE3 of its wordings (`policy.hash`).
  hash bytea NOT NULL,
  adopted date NOT NULL,
  applies date NOT NULL,
  ends date CHECK (ends >= applies),
  replaces text UNIQUE REFERENCES policy.policy,
  -- The action that ended it, `m-2026-020/1`, if a motion did.
  ended_by text CHECK ((ended_by IS NULL) OR (ends IS NOT NULL)),
  UNIQUE (motion, n),
  CHECK (id = motion || '/' || n)
);

CREATE INDEX ON policy.policy (circle, kind);

-- What a policy says: its legal wording, which binds, each value marked
-- once as `{name: value}`, and perhaps a friendly one beside it, in
-- plain words, which never binds and marks none.
CREATE TABLE policy.wording (
  policy text PRIMARY KEY REFERENCES policy.policy,
  legal text NOT NULL,
  friendly text
);

-- Each value marked in a policy's legal wording, in the order it reads:
-- its name, its type, as written and typed, and which way is stricter,
-- where it says. The feat that reads a kind of policy copies these into
-- its own typed rows at adoption.
CREATE TABLE policy.value (
  policy text NOT NULL REFERENCES policy.policy,
  n integer NOT NULL CHECK (n > 0),
  name text NOT NULL CHECK (name ~ '^[a-z][a-z0-9_]*$'),
  type text NOT NULL CHECK (type IN ('amount', 'share', 'day', 'number', 'role', 'power', 'text')),
  literal text NOT NULL,
  value jsonb NOT NULL,
  stricter text CHECK (stricter IN ('more', 'less')),
  PRIMARY KEY (policy, name),
  UNIQUE (policy, n)
);

-- The values marked in a legal wording, in the order they read: `{rate:
-- 20 %}` is the value `rate`, written `20 %`. A value may say after a bar
-- which way is stricter, `{minimum: 20 | more is stricter}`: `said` is
-- what the bar says, and `stricter` is `more` or `less` where it says
-- so.
CREATE FUNCTION policy.marks(legal text) RETURNS TABLE (n integer, name text, literal text, said text, stricter text)
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT t.n::integer, t.m[1], btrim(t.m[2]), btrim(t.m[4]),
    CASE lower(regexp_replace(btrim(t.m[4]), '\s+', ' ', 'g'))
      WHEN 'more is stricter' THEN 'more'
      WHEN 'less is stricter' THEN 'less'
    END
  FROM regexp_matches(marks.legal, '\{\s*([a-z][a-z0-9_]*)\s*:([^{}|]*)(\|([^{}]*))?\}', 'g') WITH ORDINALITY AS t(m, n)
  ORDER BY t.n;
END;

-- A value's type and its typed value, from its name and how it is
-- written: `3 000 €` an amount in cents, `20 %` a share in percent,
-- `2026-01-01` or `1 January 2026` a day, `10` a number; a value named
-- `role` or `power`, or ending so (`payer_role`), a role or a power by
-- its id; anything else text.
CREATE FUNCTION policy.typed(name text, literal text) RETURNS TABLE (type text, value jsonb)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT x.type, x.value
  FROM (SELECT translate(typed.literal, E'   ', '') AS bare) b,
  LATERAL (
    SELECT CASE
      WHEN typed.name ~ '(^|_)role$' THEN 'role'
      WHEN typed.name ~ '(^|_)power$' THEN 'power'
      WHEN b.bare ~ '^[0-9]+([.,][0-9]{1,2})?€$' THEN 'amount'
      WHEN b.bare ~ '^[0-9]+([.,][0-9]+)?%$' THEN 'share'
      WHEN typed.literal ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN 'day'
      WHEN typed.literal ~* '^[0-9]{1,2} (january|february|march|april|may|june|july|august|september|october|november|december) [0-9]{4}$' THEN 'day'
      WHEN b.bare ~ '^-?[0-9]+([.,][0-9]+)?$' THEN 'number'
      ELSE 'text'
    END AS type
  ) k,
  LATERAL (
    SELECT k.type, CASE k.type
      WHEN 'amount' THEN to_jsonb(round(replace(rtrim(b.bare, '€'), ',', '.')::numeric * 100)::bigint)
      WHEN 'share' THEN to_jsonb(replace(rtrim(b.bare, '%'), ',', '.')::numeric)
      WHEN 'number' THEN to_jsonb(replace(b.bare, ',', '.')::numeric)
      WHEN 'day' THEN to_jsonb(to_char(CASE WHEN typed.literal ~ '^[0-9]{4}-' THEN typed.literal::date
                                            ELSE to_date(typed.literal, 'FMDD FMMonth YYYY') END, 'YYYY-MM-DD'))
      ELSE to_jsonb(typed.literal)
    END AS value
  ) x;
END;

-- A legal wording as it reads, each mark replaced by its value as
-- written, without the way it says is stricter.
CREATE FUNCTION policy.sentence(legal text) RETURNS text
LANGUAGE sql IMMUTABLE
RETURN regexp_replace(legal, '\{\s*[a-z][a-z0-9_]*\s*:\s*([^{}|]*[^{}|[:space:]])\s*(\|[^{}]*)?\}', '\1', 'g');

-- What is wrong with a policy's wordings, or null: a legal wording says
-- something, marks each value once, by a name and with a value, and holds
-- no brace that is not a mark, and says which way is stricter, where it
-- says, as more or less; a friendly wording marks none, since only the
-- legal one binds and a value exists once.
CREATE FUNCTION policy.flaw(legal text, friendly text) RETURNS text
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN coalesce(btrim(flaw.legal), '') = '' THEN 'a policy is a sentence: its legal wording says what binds'
    WHEN (SELECT m.name FROM policy.marks(flaw.legal) m GROUP BY m.name HAVING count(*) > 1 ORDER BY m.name LIMIT 1) IS NOT NULL
      THEN (SELECT m.name FROM policy.marks(flaw.legal) m GROUP BY m.name HAVING count(*) > 1 ORDER BY m.name LIMIT 1)
        || ' is marked twice: each value is marked once in its sentence'
    WHEN EXISTS (SELECT FROM policy.marks(flaw.legal) m WHERE m.literal = '')
      THEN (SELECT m.name FROM policy.marks(flaw.legal) m WHERE m.literal = '' ORDER BY m.n LIMIT 1) || ' is marked with no value'
    WHEN EXISTS (SELECT FROM policy.marks(flaw.legal) m WHERE m.said IS NOT NULL AND m.stricter IS NULL)
      THEN (SELECT m.name || ' says "' || m.said || '": a value says which way is stricter as "more is stricter" or "less is stricter"'
            FROM policy.marks(flaw.legal) m WHERE m.said IS NOT NULL AND m.stricter IS NULL ORDER BY m.n LIMIT 1)
    WHEN policy.sentence(flaw.legal) ~ '[{}]'
      THEN 'a brace in a policy marks a value, as {name: value}: "' || policy.sentence(flaw.legal) || '"'
    WHEN flaw.friendly ~ '[{}]' THEN 'a policy''s friendly wording marks no value: only its legal wording binds'
  END;
END;

-- What is wrong with a policy of a kind, or null: its wordings
-- (`policy.flaw`); a value of no order, a text, a role or a power, says
-- no way is stricter; and each ordered value of a rule, an amount, a
-- share, a day or a number, says which way is, so a rule that tightens
-- can be told from one that loosens.
CREATE FUNCTION policy.flaw(kind text, legal text, friendly text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(policy.flaw(flaw.legal, flaw.friendly), (
    SELECT CASE
      WHEN t.type IN ('text', 'role', 'power') THEN m.name || ' is ' || CASE t.type WHEN 'text' THEN 'text' ELSE 'a ' || t.type END
        || ', which has no order: only an amount, a share, a day or a number says which way is stricter'
      ELSE m.name || ' is ' || m.literal || ': a rule''s value says which way is stricter, as {'
        || m.name || ': ' || m.literal || ' | more is stricter}'
    END
    FROM policy.marks(flaw.legal) m, policy.typed(m.name, m.literal) t
    WHERE (t.type IN ('text', 'role', 'power') AND m.stricter IS NOT NULL)
       OR (flaw.kind = 'rule' AND t.type NOT IN ('text', 'role', 'power') AND m.stricter IS NULL)
    ORDER BY m.n
    LIMIT 1
  ));
END;

-- What a motion adopts of a policy: the BLAKE3 of its wordings, legal
-- and friendly, as a JSON array.
CREATE FUNCTION policy.hash(legal text, friendly text) RETURNS bytea
LANGUAGE sql IMMUTABLE
RETURN cella.digest(jsonb_build_array(legal, friendly)::text);

-- The policies of a circle in force on a day: applying from it or
-- before, and not ended by it.
CREATE FUNCTION policy.in_force(circle text, day date) RETURNS SETOF policy.policy
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT p.* FROM policy.policy p
  WHERE p.circle = in_force.circle AND p.applies <= in_force.day AND (p.ends IS NULL OR p.ends > in_force.day)
  ORDER BY p.applies, p.id;
END;

-- A policy's legal wording as it reads, for a guard to quote in the
-- reason it refuses: never a value to decide by, which a guard reads from
-- its own columns. It runs with its owner's rights, since the guards role
-- reads no wording.
CREATE FUNCTION policy.says(ref text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
RETURN (SELECT policy.sentence(w.legal) FROM policy.wording w WHERE w.policy = says.ref);


-- Adopts a policy, inside the write of the action that adopts it: its
-- wordings, its values as its legal wording marks them, from the day it
-- applies, perhaps until a day, perhaps replacing a policy of the same
-- circle and kind, which ends the day this one applies. A flawed
-- wording, or a replacement of a policy not in force there, is refused
-- (SQLSTATE 09000). It runs with its owner's rights, since nothing else
-- writes the register, and only the app may call it; the notary's
-- trigger refuses its rows outside a write.
CREATE FUNCTION policy.adopt(
  circle text, kind text, legal text, friendly text, motion text, n integer,
  applies date, until date, replaces text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  made text := adopt.motion || '/' || adopt.n;
  wrong text := policy.flaw(adopt.kind, adopt.legal, adopt.friendly);
  prior policy.policy;
BEGIN
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF EXISTS (SELECT FROM policy.policy p WHERE p.id = made) THEN
    RAISE EXCEPTION '% is adopted already', made USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF adopt.replaces IS NOT NULL THEN
    SELECT * INTO prior FROM policy.policy p WHERE p.id = adopt.replaces;
    IF prior.id IS NULL OR prior.circle <> adopt.circle OR prior.kind <> adopt.kind
      OR prior.applies > adopt.applies OR (prior.ends IS NOT NULL AND prior.ends <= adopt.applies) THEN
      RAISE EXCEPTION '% replaces no % of % in force on %', made, adopt.kind, adopt.circle, adopt.applies
        USING ERRCODE = 'triggered_action_exception';
    END IF;
    UPDATE policy.policy p SET ends = adopt.applies WHERE p.id = adopt.replaces;
  END IF;
  INSERT INTO policy.policy (id, circle, kind, motion, n, hash, adopted, applies, ends, replaces)
  VALUES (made, adopt.circle, adopt.kind, adopt.motion, adopt.n, policy.hash(adopt.legal, adopt.friendly),
          cella.verdict_date(), adopt.applies, adopt.until, adopt.replaces);
  INSERT INTO policy.wording (policy, legal, friendly) VALUES (made, adopt.legal, nullif(btrim(adopt.friendly), ''));
  INSERT INTO policy.value (policy, n, name, type, literal, value, stricter)
  SELECT made, m.n, m.name, t.type, m.literal, t.value, m.stricter
  FROM policy.marks(adopt.legal) m, policy.typed(m.name, m.literal) t;
  RETURN made;
END
$$;

-- Ends a policy on the verdict date, inside the write of the action that
-- ends it, `by_motion`'s action `by_n`, which it records. A policy not in force
-- on the verdict date is refused (SQLSTATE 09000). It runs with its
-- owner's rights, as `policy.adopt` does, and only the app may call it.
CREATE FUNCTION policy.end(ref text, by_motion text, by_n integer) RETURNS date
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  ended date;
BEGIN
  UPDATE policy.policy p SET ends = cella.verdict_date(), ended_by = by_motion || '/' || by_n
  WHERE p.id = ref AND p.applies <= cella.verdict_date() AND (p.ends IS NULL OR p.ends > cella.verdict_date())
  RETURNING p.ends INTO ended;
  IF ended IS NULL THEN
    RAISE EXCEPTION '% is no policy in force on %', ref, cella.verdict_date()
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN ended;
END
$$;

REVOKE EXECUTE ON FUNCTION policy.adopt(text, text, text, text, text, integer, date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION policy.adopt(text, text, text, text, text, integer, date, date, text) TO cella_app;
REVOKE EXECUTE ON FUNCTION policy.end(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION policy.end(text, text, integer) TO cella_app;

GRANT USAGE ON SCHEMA policy TO cella_app, cella_guards;
GRANT SELECT ON policy.policy, policy.value TO cella_app, cella_guards;
GRANT SELECT ON policy.wording TO cella_app;
REVOKE EXECUTE ON FUNCTION policy.says(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION policy.says(text) TO cella_app, cella_guards;
