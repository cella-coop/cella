-- The policy register: every policy a circle adopted by motion, its kind,
-- its wordings, the values marked in its legal wording, the motion and
-- the action of it that adopted it, the day it applies from and the day
-- it ends, the policy it replaces, the action that ended it and the
-- default it takes; and the legal forms cella offers, with their default
-- policies. A core
-- library's, beside the notary: it knows no feat, so a motion is named by
-- its id and no foreign key leaves the schema. Only `policy.adopt` and `policy.end` write it,
-- inside a write a motion carries; every slice reads its policies and
-- values, and only the app reads the wording, which no guard reads. A
-- form's defaults are written by its migration alone, through
-- `policy.offer`.
CREATE SCHEMA policy;

-- A legal form in a region, as cella offers it: a kind of coop the law
-- knows, `scop-sarl-fr`, a SCOP SARL in France, with its ready-made
-- policies. Cella offers the forms; a coop chooses one.
CREATE TABLE policy.form (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]*$'),
  label text NOT NULL,
  region text NOT NULL
);

-- A default policy of a form, `scop-sarl-fr:ordinary`, in the form's
-- order: its kind, its wordings and their hash, as `policy.hash` makes
-- it, perhaps the procedure that alone changes it, the law it states, by
-- its article, or none where it is cella's practice, and the day a coop
-- lawyer reviewed it, empty until one has. Only `policy.offer` writes it,
-- from a form's migration.
CREATE TABLE policy.default (
  id text PRIMARY KEY,
  form text NOT NULL REFERENCES policy.form,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9-]*$'),
  n integer NOT NULL CHECK (n > 0),
  kind text NOT NULL CHECK (kind IN ('mandate', 'right', 'rule', 'procedure')),
  legal text NOT NULL,
  friendly text,
  hash bytea NOT NULL,
  protected text CHECK (protected ~ '^[a-z][a-z-]*$'),
  source text CHECK (btrim(source) <> ''),
  reviewed date,
  UNIQUE (form, key),
  UNIQUE (form, n),
  CHECK (id = form || ':' || key)
);

-- A policy's id is the action that adopted it: its motion and its number
-- there, `m-2026-013/1`.
CREATE TABLE policy.policy (
  id text PRIMARY KEY,
  circle text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('mandate', 'right', 'rule', 'procedure')),
  motion text NOT NULL,
  n integer NOT NULL CHECK (n > 0),
  -- What the motion adopted: the BLAKE3 of its wordings (`policy.hash`).
  hash bytea NOT NULL,
  adopted date NOT NULL,
  applies date NOT NULL,
  -- After the day it applies where its adoption sets it (`policy.adopt`
  -- refuses one that is not); the day a motion ends or replaces it, which
  -- may be that day.
  ends date CHECK (ends >= applies),
  replaces text UNIQUE REFERENCES policy.policy,
  -- The action that ended it, `m-2026-020/1`, if a motion did.
  ended_by text CHECK ((ended_by IS NULL) OR (ends IS NOT NULL)),
  -- The procedure by which alone it is replaced or ended, by its name as
  -- the motion feat names it, for a protected policy; the motion feat's
  -- guards hold a motion that changes it to that procedure or a stricter
  -- one.
  protected text CHECK (protected ~ '^[a-z][a-z-]*$'),
  -- The default policy it takes, worded and protected as that default
  -- read when it was adopted, if it takes one.
  takes text REFERENCES policy.default,
  UNIQUE (motion, n),
  CHECK (id = motion || '/' || n)
);

CREATE INDEX ON policy.policy (circle, kind);
CREATE INDEX ON policy.policy (takes);

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
-- its id; the coop's SIREN and capital (`particulars_siren`,
-- `particulars_capital`) text, as its papers print them; anything else
-- text.
CREATE FUNCTION policy.typed(name text, literal text) RETURNS TABLE (type text, value jsonb)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT x.type, x.value
  FROM (SELECT translate(typed.literal, E'   ', '') AS bare) b,
  LATERAL (
    SELECT CASE
      WHEN typed.name ~ '(^|_)role$' THEN 'role'
      WHEN typed.name ~ '(^|_)power$' THEN 'power'
      WHEN typed.name IN ('particulars_siren', 'particulars_capital') THEN 'text'
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
-- and friendly, as a JSON array, the friendly wording trimmed and an
-- empty one none, as `policy.wording` keeps it. It is the one canonical
-- form: every caller hashes through it and trims nothing itself.
CREATE FUNCTION policy.hash(legal text, friendly text) RETURNS bytea
LANGUAGE sql IMMUTABLE
RETURN cella.digest(jsonb_build_array(legal, nullif(btrim(friendly), ''))::text);

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
-- reads no wording, and no role calls it: who may read a policy is the
-- circles' to say, so it is quoted through core's graft joining them to
-- the register, `circle_policy.says`.
CREATE FUNCTION policy.says(ref text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
RETURN (SELECT policy.sentence(w.legal) FROM policy.wording w WHERE w.policy = says.ref);

-- Offers a default policy of a form, from the form's migration: a new one
-- after the form's others, or the same one on a new wording, which a
-- later release of cella ships and no policy follows by itself; a default
-- whose wording changes is reviewed anew. A flawed wording for its kind
-- is refused (SQLSTATE 09000). Returns its id.
CREATE FUNCTION policy.offer(
  form text, key text, kind text, legal text, friendly text, protected text, source text
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  made text := offer.form || ':' || offer.key;
  wrong text := policy.flaw(offer.kind, offer.legal, offer.friendly);
BEGIN
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%: %', made, wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  INSERT INTO policy.default AS d (id, form, key, n, kind, legal, friendly, hash, protected, source)
  VALUES (made, offer.form, offer.key,
          coalesce((SELECT max(o.n) FROM policy.default o WHERE o.form = offer.form), 0) + 1,
          offer.kind, offer.legal, nullif(btrim(offer.friendly), ''),
          policy.hash(offer.legal, offer.friendly), offer.protected, offer.source)
  ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, legal = excluded.legal, friendly = excluded.friendly,
    hash = excluded.hash, protected = excluded.protected, source = excluded.source,
    reviewed = CASE WHEN d.hash = excluded.hash THEN d.reviewed END;
  RETURN made;
END
$$;

-- What keeps a policy from taking a default, or null: the default is
-- one the register offers, and the policy is of its kind, worded as it
-- reads now, by the hash of its wordings, and protected as it is. A
-- guard may call it: it reads no wording.
CREATE FUNCTION policy.takes_flaw(takes text, kind text, legal text, friendly text, protected text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN takes_flaw.takes IS NULL THEN NULL
    WHEN d.id IS NULL THEN 'no legal form offers a default ' || takes_flaw.takes
    WHEN d.kind <> takes_flaw.kind THEN d.id || ' is a ' || d.kind || ', not a ' || coalesce(takes_flaw.kind, 'policy of no kind')
    WHEN d.hash <> policy.hash(takes_flaw.legal, takes_flaw.friendly)
      THEN 'a policy takes ' || d.id || ' worded as it reads: one worded otherwise takes no default'
    WHEN d.protected IS DISTINCT FROM nullif(takes_flaw.protected, '')
      THEN d.id || CASE WHEN d.protected IS NULL THEN ' is protected by no procedure'
                        ELSE ' is protected by ' || d.protected END
        || ': a policy takes it protected as it is'
  END
  FROM (SELECT 1) one
  LEFT JOIN policy.default d ON d.id = takes_flaw.takes;
END;

-- Where each default of a form stands in a circle on a day, for each
-- form the circle took any default of, in the form's order: `taken`, a
-- policy in force takes it as it reads; `updated`, a policy in force takes
-- it as it read before cella changed it; `left`, the last policy that
-- took it ended, by the motion's action that replaced it with a policy
-- taking none or that ended it, `left_by`, on `left_on`; `not taken`, no
-- policy of the circle took it.
CREATE FUNCTION policy.standing(circle text, day date) RETURNS TABLE (
  id text, form text, form_label text, kind text, sentence text, source text, reviewed date,
  standing text, policy text, left_by text, left_on date
)
LANGUAGE sql STABLE
BEGIN ATOMIC
  WITH took AS (
    SELECT DISTINCT ON (p.takes) p.*
    FROM policy.policy p
    WHERE p.circle = standing.circle AND p.takes IS NOT NULL AND p.applies <= standing.day
    ORDER BY p.takes, p.applies DESC, p.id DESC
  )
  SELECT d.id, f.id, f.label || ', ' || f.region, d.kind, policy.sentence(d.legal), d.source, d.reviewed,
    CASE
      WHEN t.id IS NULL THEN 'not taken'
      WHEN t.ends <= standing.day THEN 'left'
      WHEN t.hash <> d.hash OR t.protected IS DISTINCT FROM d.protected THEN 'updated'
      ELSE 'taken'
    END,
    t.id,
    CASE WHEN t.ends <= standing.day THEN coalesce(t.ended_by, (SELECT r.id FROM policy.policy r WHERE r.replaces = t.id)) END,
    CASE WHEN t.ends <= standing.day THEN t.ends END
  FROM policy.form f
  JOIN policy.default d ON d.form = f.id
  LEFT JOIN took t ON t.takes = d.id
  WHERE f.id IN (SELECT o.form FROM took k JOIN policy.default o ON o.id = k.takes)
  ORDER BY f.id, d.n;
END;

-- The defaults a motion left, by its actions: each policy taking a
-- default that one of them ended, or replaced with a policy taking none,
-- with the action that did.
CREATE FUNCTION policy.left_by(motion text) RETURNS TABLE (
  id text, form_label text, sentence text, policy text, action text
)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT d.id, f.label || ', ' || f.region, policy.sentence(d.legal), p.id, coalesce(r.id, p.ended_by)
  FROM policy.policy p
  JOIN policy.default d ON d.id = p.takes
  JOIN policy.form f ON f.id = d.form
  LEFT JOIN policy.policy r ON r.replaces = p.id
  WHERE (r.motion = left_by.motion AND r.takes IS DISTINCT FROM p.takes)
     OR (r.id IS NULL AND split_part(p.ended_by, '/', 1) = left_by.motion)
  ORDER BY coalesce(r.n, split_part(p.ended_by, '/', 2)::integer);
END;


-- Adopts a policy, inside the write of the action that adopts it: its
-- wordings, its values as its legal wording marks them, from the day it
-- applies, perhaps until a day, perhaps replacing a policy of the same
-- circle and kind, which ends the day this one applies, perhaps
-- protected by the procedure that alone changes it, perhaps taking a
-- default. A flawed wording, an end not after the day it applies, since
-- it binds until the day before it ends (`policy.in_force`), a
-- replacement of a policy not in force there, a default it is not worded
-- and protected as, or one a policy in force it does not replace takes
-- already, is refused (SQLSTATE 09000). It
-- runs with its owner's rights, since nothing else writes the register,
-- and only the app may call it; the notary's trigger refuses its rows
-- outside a write.
CREATE FUNCTION policy.adopt(
  circle text, kind text, legal text, friendly text, motion text, n integer,
  applies date, until date, replaces text, protected text DEFAULT NULL, takes text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  made text := adopt.motion || '/' || adopt.n;
  wrong text := coalesce(policy.flaw(adopt.kind, adopt.legal, adopt.friendly),
    policy.takes_flaw(adopt.takes, adopt.kind, adopt.legal, adopt.friendly, adopt.protected));
  taken text;
  prior policy.policy;
BEGIN
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF EXISTS (SELECT FROM policy.policy p WHERE p.id = made) THEN
    RAISE EXCEPTION '% is adopted already', made USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF adopt.until <= adopt.applies THEN
    RAISE EXCEPTION '% would end on %, not after %, the day it applies: a policy ends after the day it applies',
      made, to_char(adopt.until, 'YYYY-MM-DD'), to_char(adopt.applies, 'YYYY-MM-DD')
      USING ERRCODE = 'triggered_action_exception';
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
  SELECT f.id INTO taken FROM policy.in_force(adopt.circle, adopt.applies) f
  WHERE f.takes = adopt.takes AND f.id IS DISTINCT FROM adopt.replaces;
  IF taken IS NOT NULL THEN
    RAISE EXCEPTION '% takes % already: a policy taking it again replaces that one', taken, adopt.takes
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  INSERT INTO policy.policy (id, circle, kind, motion, n, hash, adopted, applies, ends, replaces, protected, takes)
  VALUES (made, adopt.circle, adopt.kind, adopt.motion, adopt.n, policy.hash(adopt.legal, adopt.friendly),
          cella.verdict_date(), adopt.applies, adopt.until, adopt.replaces, adopt.protected, adopt.takes);
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

REVOKE EXECUTE ON FUNCTION policy.adopt(text, text, text, text, text, integer, date, date, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION policy.adopt(text, text, text, text, text, integer, date, date, text, text, text) TO cella_app;
REVOKE EXECUTE ON FUNCTION policy.end(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION policy.end(text, text, integer) TO cella_app;

GRANT USAGE ON SCHEMA policy TO cella_app, cella_guards;
GRANT SELECT ON policy.policy, policy.value TO cella_app, cella_guards;
GRANT SELECT ON policy.wording TO cella_app;
REVOKE EXECUTE ON FUNCTION policy.says(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION policy.offer(text, text, text, text, text, text, text) FROM PUBLIC;

-- The forms and their defaults: the app reads them whole; the guards role
-- all but a default's wordings, as it reads no policy's.
GRANT SELECT ON policy.form, policy.default TO cella_app;
GRANT SELECT ON policy.form TO cella_guards;
GRANT SELECT (id, form, key, n, kind, hash, protected, source, reviewed) ON policy.default TO cella_guards;
