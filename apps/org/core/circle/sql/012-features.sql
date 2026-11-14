-- A circle's features: the features the co-op installed that the circle
-- enabled, each in its place in the circle's order and perhaps under an
-- accordion of the circle's naming. A setting of the circle beside its
-- name, purpose and procedure, changed as they are, by motion,
-- `circle:circle:amend` (`010-create.sql`).
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

-- An amendment replaces a circle's features by the listing it gives.
GRANT SELECT ON circle.feature TO cella_app, cella_guards;
GRANT INSERT, DELETE ON circle.feature TO cella_app;

-- The features are the structure's, read as the circles are.
ALTER TABLE circle.feature ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.feature TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR circle = ANY ((SELECT circle.own())::text[])
    OR (SELECT circle.published('circles'))) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.feature FOR SELECT TO cella_guards USING (true);
