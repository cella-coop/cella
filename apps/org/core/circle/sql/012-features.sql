-- A circle's features: the features the co-op installed that the circle
-- enabled, each in its place in the circle's order and perhaps under an
-- accordion of the circle's naming. A setting of the circle beside its
-- name, purpose and procedure, but decided apart from them, under its own
-- power, `arrange-features`: arranged at once by whoever holds it over the
-- circle by a seat (`circle:feature:arrange`), or by a motion of a circle
-- holding it over the circle as a collective mandate
-- (`circle:circle:arrange`).
CREATE TABLE circle.feature (
  circle text NOT NULL REFERENCES circle.circle,
  feat text NOT NULL CHECK (feat ~ '\S'),
  position integer NOT NULL CHECK (position >= 0),
  "group" text CHECK ("group" ~ '\S'),
  PRIMARY KEY (circle, feat),
  UNIQUE (circle, position)
);

-- The features the co-op installed: core's collections a circle shows
-- or not, its circles and mandates, its people and its register, and
-- every feat, each owning a power in `cella.power`, as a graft's
-- hyphenated name never is one.
CREATE FUNCTION circle.installed() RETURNS SETOF text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT f FROM (
    SELECT unnest(ARRAY['circle', 'person', 'policy'])
    UNION
    SELECT p.owner FROM cella.power p WHERE p.owner ~ '^[a-z]+$'
  ) x(f)
  ORDER BY f;
END;

-- A listing read into its rows: the features in order, separated by
-- commas, an accordion's run after its name and a colon, the runs
-- separated by semicolons, so `Books: account, transaction; contact`.
-- Each feature's position is its place in the listing, from 0; an
-- accordion named blank is read as blank, for the guard to refuse.
CREATE FUNCTION circle.listed(listing text) RETURNS TABLE (feat text, "position" integer, "group" text)
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT btrim(f.feat), (row_number() OVER (ORDER BY s.n, f.m) - 1)::integer,
    CASE WHEN strpos(s.run, ':') > 0 THEN btrim(split_part(s.run, ':', 1)) END
  FROM string_to_table(coalesce(listed.listing, ''), ';') WITH ORDINALITY s(run, n)
  CROSS JOIN LATERAL string_to_table(CASE WHEN strpos(s.run, ':') > 0 THEN substr(s.run, strpos(s.run, ':') + 1) ELSE s.run END, ',')
    WITH ORDINALITY f(feat, m)
  WHERE btrim(f.feat) <> ''
  ORDER BY s.n, f.m;
END;

-- Features in order, each with its accordion, spelt as one listing:
-- each run of an accordion's after its name and a colon, the runs
-- separated by `; `, the features by `, `.
CREATE FUNCTION circle.spell(feats text[], groups text[]) RETURNS text
LANGUAGE sql IMMUTABLE
RETURN (
  SELECT coalesce(string_agg(r.run, '; ' ORDER BY r.first), '')
  FROM (
    SELECT min(x.i) AS first, coalesce(x.g || ': ', '') || string_agg(x.f, ', ' ORDER BY x.i) AS run
    FROM (
      SELECT u.f, u.g, u.i, u.i - row_number() OVER (PARTITION BY u.g ORDER BY u.i) AS island
      FROM unnest(spell.feats, spell.groups) WITH ORDINALITY u(f, g, i)
    ) x
    GROUP BY x.g, x.island
  ) r
);

-- A listing spelt canonically, as `circle.features` spells a circle's.
CREATE FUNCTION circle.spelt(listing text) RETURNS text
LANGUAGE sql IMMUTABLE
RETURN (SELECT circle.spell(coalesce(array_agg(l.feat ORDER BY l.position), '{}'), coalesce(array_agg(l."group" ORDER BY l.position), '{}'))
        FROM circle.listed(spelt.listing) l);

-- A circle's features, spelt as one listing; empty where it enabled none.
CREATE FUNCTION circle.features(circle text) RETURNS text
LANGUAGE sql STABLE
RETURN (SELECT circle.spell(coalesce(array_agg(f.feat ORDER BY f.position), '{}'), coalesce(array_agg(f."group" ORDER BY f.position), '{}'))
        FROM circle.feature f WHERE f.circle = features.circle);

-- What is wrong with a listing of `circle`'s features that would replace
-- `was`, the listing it has, or null: the circle is one there is; each
-- feature is one the co-op installed (`circle.installed`), none twice,
-- each accordion named and its features listed together; and it changes
-- something of `was`, compared as spelt (`circle.spelt`). An empty
-- listing enables none. Judged as a motion proposes an arrangement, and
-- again as one is written, by the motion or at once.
CREATE FUNCTION circle.listing_flaw(circle text, listing text, was text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL
      THEN 'no circle ' || coalesce(listing_flaw.circle, 'is named') || ': features are arranged for a circle there is, by its id'
    WHEN u.feat IS NOT NULL
      THEN u.feat || ' is no feature the co-op has installed: give ' || c.id || ' features of ' || (SELECT string_agg(i, ', ') FROM circle.installed() i)
    WHEN t.feat IS NOT NULL
      THEN 'the features of ' || c.id || ' name ' || t.feat || ' twice: list each once'
    WHEN EXISTS (SELECT FROM circle.listed(listing_flaw.listing) l WHERE l."group" !~ '\S')
      THEN 'an accordion of ' || c.id || '''s features has a blank name: name it, or list its features under none'
    WHEN g.name IS NOT NULL
      THEN 'the features of ' || c.id || ' list the ' || g.name || ' accordion''s apart: list them together'
    WHEN circle.spelt(listing_flaw.listing) IS NOT DISTINCT FROM circle.spelt(listing_flaw.was)
      THEN 'the arrangement of ' || c.id || ' changes nothing: its features are ' || coalesce(nullif(circle.spelt(listing_flaw.was), ''), 'none')
        || ' already; enable, disable or move one'
  END
  FROM (SELECT listing_flaw.circle AS circle) p
  LEFT JOIN circle.circle c ON c.id = p.circle
  LEFT JOIN LATERAL (
    SELECT l.feat FROM circle.listed(listing_flaw.listing) l
    WHERE l.feat NOT IN (SELECT circle.installed())
    ORDER BY l.position
    LIMIT 1
  ) u ON true
  LEFT JOIN LATERAL (
    SELECT l.feat FROM circle.listed(listing_flaw.listing) l
    GROUP BY l.feat HAVING count(*) > 1
    ORDER BY min(l.position)
    LIMIT 1
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT r.g AS name FROM (
      SELECT l."group" AS g, l.position - row_number() OVER (PARTITION BY l."group" ORDER BY l.position) AS island
      FROM circle.listed(listing_flaw.listing) l
      WHERE l."group" IS NOT NULL
    ) r
    GROUP BY r.g HAVING count(DISTINCT r.island) > 1
    ORDER BY r.g
    LIMIT 1
  ) g ON true;
END;

-- Whether the circle `decider` holds `arrange-features` over the circle
-- `subject` on `day`: a collective mandate in force for it whose scope
-- covers the subject (`circle.covers`), its own circle for `own`, the
-- circle it names, or every circle where it marks none. Unlike a
-- circle's name, purpose and procedure, which another circle decides
-- (`amend-circle`, `motion.decides`), a circle holding it over itself
-- arranges its own features by its own motion.
CREATE FUNCTION circle.arranges(decider text, subject text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle.mandate m
    JOIN circle.grantee g ON g.id = m.grantee AND g.kind = 'circle'
    WHERE m.grantee = arranges.decider
      AND m.power = 'arrange-features'
      AND arranges.subject IS NOT NULL
      AND circle.covers(m.scope, arranges.decider, arranges.subject)
      AND (m."from" IS NULL OR m."from" <= arranges.day)
      AND (m.until IS NULL OR m.until > arranges.day)
      AND (m.revoked IS NULL OR m.revoked > arranges.day)
  );
END;

-- The circle whose motion arranges `subject`'s features on `day`: the
-- circle itself where it holds `arrange-features` over itself
-- (`circle.arranges`), else the first other circle by id holding it over
-- the subject, the assembly last; null where none does.
CREATE FUNCTION circle.arranger(subject text, day date) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT c.id FROM circle.circle c
  WHERE circle.arranges(c.id, arranger.subject, arranger.day)
  ORDER BY c.id IS DISTINCT FROM arranger.subject, c.assembly, c.id
  LIMIT 1;
END;

-- circle:feature:arrange — the features a holder of `arrange-features`
-- wrote at once are a sound listing of the circle's, judged against what
-- its entry says they were (`circle.listing_flaw`), and the circle has
-- them now. Whether the actor holds the power over the circle is core's
-- guard on every op with a power, by the circle the payload names
-- (`circle_person.empowered`).
CREATE FUNCTION circle.arranged(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    circle.listing_flaw(payload ->> 'circle', payload ->> 'features', payload ->> 'was'),
    CASE WHEN circle.features(payload ->> 'circle') IS DISTINCT FROM circle.spelt(payload ->> 'features')
      THEN 'the features of ' || (payload ->> 'circle') || ' are not ' || coalesce(payload ->> 'features', 'none') || ' as its entry says' END
  );
END;

-- A holder's own arrangement needs `arrange-features` over the circle its
-- payload names, by a mandate on a seat; a motion's,
-- `circle:circle:arrange`, needs it as the motion's circle's collective
-- mandate, which the graft citing the motion registers in `motion.cites`.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('circle:feature:arrange', 'arrange-features', NULL, 'circle');
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('circle:feature:arrange', 'circle.arranged(jsonb)', 'circle');

-- An arrangement replaces a circle's features by the listing it gives.
GRANT SELECT ON circle.feature TO cella_app, cella_guards;
GRANT INSERT, DELETE ON circle.feature TO cella_app;

-- The features are the structure's, read as the circles are.
ALTER TABLE circle.feature ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.feature TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR circle = ANY ((SELECT circle.own())::text[])
    OR (SELECT circle.published('circles'))) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.feature FOR SELECT TO cella_guards USING (true);
