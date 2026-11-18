-- The co-op's features: the co-op's layout, every feature it enables, each
-- in its place under one of its groups, and what each other circle shows
-- of it, the groups it shows and the features it hides inside them. The
-- layout is the root's listing, arranged under its own power,
-- `arrange-features` over the root: at once by whoever holds it over the
-- root by a seat (`circle:feature:arrange`), or by a motion of a circle
-- holding it over the root as a collective mandate
-- (`circle:circle:arrange`). A feature the co-op installed that the layout
-- leaves out is enabled nowhere. A circle's rows change under
-- `arrange-features` over that circle, one row a write: a group shown or
-- not (`circle:group:show`, by motion `circle:circle:show`), a feature
-- hidden or not (`circle:feature:hide`, by motion `circle:circle:hide`).
-- A circle drops what it does not show, and never moves or renames what
-- it shows, so every circle's sidebar draws the layout in its order.

-- A group of the layout, by an id it keeps whatever it is renamed, its
-- name and its place among the groups, from 0.
CREATE TABLE circle.feature_group (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (name ~ '\S'),
  position integer NOT NULL CHECK (position >= 0),
  CONSTRAINT feature_group_name UNIQUE (name) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT feature_group_position UNIQUE (position) DEFERRABLE INITIALLY DEFERRED
);

-- A feature the layout enables, under its group, in its place in the
-- layout, from 0, a group's features together.
CREATE TABLE circle.feature (
  feat text PRIMARY KEY CHECK (feat ~ '\S'),
  "group" text NOT NULL REFERENCES circle.feature_group,
  position integer NOT NULL CHECK (position >= 0),
  CONSTRAINT feature_position UNIQUE (position) DEFERRABLE INITIALLY DEFERRED
);

-- A group of the layout a circle other than the root shows.
CREATE TABLE circle.shown (
  circle text NOT NULL REFERENCES circle.circle,
  "group" text NOT NULL REFERENCES circle.feature_group,
  PRIMARY KEY (circle, "group")
);

-- A feature of the layout a circle other than the root hides, where its
-- group is shown; kept as the feature moves to another group.
CREATE TABLE circle.hidden (
  circle text NOT NULL REFERENCES circle.circle,
  feat text NOT NULL REFERENCES circle.feature,
  PRIMARY KEY (circle, feat)
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
-- commas, a group's run after its name and a colon, the runs separated
-- by semicolons, so `Books: account, transaction; Work: project`. Each
-- feature's position is its place in the listing, from 0; a group named
-- blank is read as blank, and a feature under none as under no group,
-- for the guard to refuse.
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

-- Features in order, each with its group, spelt as one listing: each run
-- of a group's after its name and a colon, the runs separated by `; `,
-- the features by `, `.
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

-- A listing spelt canonically, as `circle.features` spells one.
CREATE FUNCTION circle.spelt(listing text) RETURNS text
LANGUAGE sql IMMUTABLE
RETURN (SELECT circle.spell(coalesce(array_agg(l.feat ORDER BY l.position), '{}'), coalesce(array_agg(l."group" ORDER BY l.position), '{}'))
        FROM circle.listed(spelt.listing) l);

-- The groups a listing names, each once, in the order it first names them.
CREATE FUNCTION circle.runs(listing text) RETURNS text[]
LANGUAGE sql IMMUTABLE
RETURN (SELECT coalesce(array_agg(x.g ORDER BY x.first), '{}')
        FROM (SELECT l."group" AS g, min(l.position) AS first FROM circle.listed(runs.listing) l WHERE l."group" IS NOT NULL GROUP BY l."group") x);

-- The features a circle shows, in the layout's order, each with its
-- group's name and id: the root, the whole layout; another circle, the
-- features of the groups it shows but those it hides.
CREATE FUNCTION circle.showing(circle text) RETURNS TABLE (feat text, "position" integer, "group" text, name text)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT f.feat, f.position, g.id, g.name
  FROM circle.feature f
  JOIN circle.feature_group g ON g.id = f."group"
  WHERE showing.circle IS NOT DISTINCT FROM circle.assembly()
    OR (EXISTS (SELECT FROM circle.shown s WHERE s.circle = showing.circle AND s."group" = g.id)
      AND NOT EXISTS (SELECT FROM circle.hidden h WHERE h.circle = showing.circle AND h.feat = f.feat))
  ORDER BY f.position;
END;

-- A circle's features, spelt as one listing: the root's, the co-op's
-- layout; another's, what it shows of it; empty where it shows none.
CREATE FUNCTION circle.features(circle text) RETURNS text
LANGUAGE sql STABLE
RETURN (SELECT circle.spell(coalesce(array_agg(s.feat ORDER BY s.position), '{}'), coalesce(array_agg(s.name ORDER BY s.position), '{}'))
        FROM circle.showing(features.circle) s);

-- The ids of the layout's groups, in its order.
CREATE FUNCTION circle.groups() RETURNS text[]
LANGUAGE sql STABLE
RETURN (SELECT coalesce(array_agg(g.id ORDER BY g.position), '{}') FROM circle.feature_group g);

-- A group's id minted from its name: its letters and digits, lowered,
-- each other run a hyphen, `group` where none is left, and a number after
-- it where `taken` holds it already.
CREATE FUNCTION circle.slug(name text, taken text[]) RETURNS text
LANGUAGE sql IMMUTABLE
RETURN (
  SELECT CASE WHEN NOT b = ANY (slug.taken) THEN b
    ELSE (SELECT b || '-' || n FROM generate_series(2, 1000) n WHERE NOT (b || '-' || n) = ANY (slug.taken) ORDER BY n LIMIT 1) END
  FROM (SELECT coalesce(nullif(btrim(regexp_replace(lower(coalesce(slug.name, '')), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'group') AS b) x
);

-- The id each group of a listing of the layout keeps, in the order it
-- names them: a group of that name already, its own; else the group
-- whose name the listing drops that shares the most features with it,
-- first in the layout on a tie, so a group renamed keeps its id and every
-- circle's choice of it; else a new one minted from its name
-- (`circle.slug`). Its handler writes them in its entry, which the fold
-- reads, so the fold mints none.
CREATE FUNCTION circle.grouped(listing text) RETURNS text[]
LANGUAGE plpgsql STABLE AS $$
DECLARE
  names text[] := circle.runs(grouped.listing);
  out text[] := '{}';
  taken text[] := circle.groups();
  n text;
  gid text;
BEGIN
  FOREACH n IN ARRAY names LOOP
    gid := (SELECT g.id FROM circle.feature_group g WHERE g.name = n);
    IF gid IS NULL THEN
      SELECT g.id INTO gid
      FROM circle.feature_group g
      WHERE g.name <> ALL (names) AND g.id <> ALL (out)
        AND EXISTS (SELECT FROM circle.feature f JOIN circle.listed(grouped.listing) l ON l.feat = f.feat AND l."group" = n WHERE f."group" = g.id)
      ORDER BY (SELECT count(*) FROM circle.feature f JOIN circle.listed(grouped.listing) l ON l.feat = f.feat AND l."group" = n WHERE f."group" = g.id) DESC, g.position
      LIMIT 1;
    END IF;
    IF gid IS NULL THEN
      gid := circle.slug(n, taken || out);
    END IF;
    out := out || gid;
  END LOOP;
  RETURN out;
END
$$;

-- The layout made the listing given, its groups by the ids given in the
-- order it names them: each group named and placed, each feature under
-- its group in its place; a feature it leaves out leaves the layout and
-- every circle's hiding of it, a group it leaves out every circle's
-- showing of it. Its handler, its fold and the seed write it alike.
CREATE FUNCTION circle.lay(listing text, ids text[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  names text[] := circle.runs(lay.listing);
BEGIN
  IF cardinality(names) <> cardinality(lay.ids) THEN
    RAISE EXCEPTION 'circle: the layout names % groups and gives % ids', cardinality(names), cardinality(lay.ids);
  END IF;
  INSERT INTO circle.feature_group (id, name, position)
  SELECT lay.ids[i], names[i], i - 1 FROM generate_subscripts(names, 1) i
  ON CONFLICT (id) DO UPDATE SET name = excluded.name, position = excluded.position;
  INSERT INTO circle.feature (feat, "group", position)
  SELECT l.feat, lay.ids[array_position(names, l."group")], l.position FROM circle.listed(lay.listing) l
  ON CONFLICT (feat) DO UPDATE SET "group" = excluded."group", position = excluded.position;
  DELETE FROM circle.hidden h WHERE h.feat NOT IN (SELECT l.feat FROM circle.listed(lay.listing) l);
  DELETE FROM circle.feature f WHERE f.feat NOT IN (SELECT l.feat FROM circle.listed(lay.listing) l);
  DELETE FROM circle.shown s WHERE s."group" <> ALL (lay.ids);
  DELETE FROM circle.feature_group g WHERE g.id <> ALL (lay.ids);
END
$$;

-- What is wrong with a listing of the co-op's layout, arranged at
-- `circle`, that would replace `was`, the layout it has, or null: the
-- circle is the root, for another shows groups of the layout and hides
-- features, never arranges them; each feature is one the co-op installed
-- (`circle.installed`), none twice, each under a group named, each
-- group's features listed together; and it changes something of `was`,
-- compared as spelt (`circle.spelt`). An empty listing enables none.
-- Judged as a motion proposes an arrangement, and again as one is
-- written, by the motion or at once.
CREATE FUNCTION circle.listing_flaw(circle text, listing text, was text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL
      THEN 'no circle ' || coalesce(listing_flaw.circle, 'is named') || ': the co-op''s features are arranged at its root, ' || coalesce(circle.assembly(), 'the assembly')
    WHEN NOT c.assembly
      THEN c.id || ' is no root: the co-op''s features are arranged at ' || coalesce(circle.assembly(), 'the assembly')
        || ', and ' || c.id || ' shows groups of them and hides features in them (show-group, hide-feature)'
    WHEN u.feat IS NOT NULL
      THEN u.feat || ' is no feature the co-op has installed: give ' || c.id || ' features of ' || (SELECT string_agg(i, ', ') FROM circle.installed() i)
    WHEN t.feat IS NOT NULL
      THEN 'the features of ' || c.id || ' name ' || t.feat || ' twice: list each once'
    WHEN EXISTS (SELECT FROM circle.listed(listing_flaw.listing) l WHERE l."group" !~ '\S')
      THEN 'a group of ' || c.id || '''s features has a blank name: name it'
    WHEN n.feat IS NOT NULL
      THEN 'the features of ' || c.id || ' put ' || n.feat || ' under no group: list it under one (Group: ' || n.feat || ')'
    WHEN g.name IS NOT NULL
      THEN 'the features of ' || c.id || ' list the ' || g.name || ' group''s apart: list them together'
    WHEN circle.spelt(listing_flaw.listing) IS NOT DISTINCT FROM circle.spelt(listing_flaw.was)
      THEN 'the arrangement of ' || c.id || ' changes nothing: its features are ' || coalesce(nullif(circle.spelt(listing_flaw.was), ''), 'none')
        || ' already; enable, disable, move or rename one'
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
    SELECT l.feat FROM circle.listed(listing_flaw.listing) l
    WHERE l."group" IS NULL
    ORDER BY l.position
    LIMIT 1
  ) n ON true
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

-- What is wrong with `circle` showing the layout's group `group`, or
-- hiding its feature `feature`, or null: the circle is one there is and
-- no root, which shows the whole layout, and the group, or the feature,
-- is one the layout has. Judged as a motion proposes it, and again as it
-- is written, by the motion or at once.
CREATE FUNCTION circle.row_flaw(circle text, "group" text, feature text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL
      THEN 'no circle ' || coalesce(row_flaw.circle, 'is named') || ': a circle there is, by its id, shows groups of the co-op''s features'
    WHEN c.assembly
      THEN c.id || ' is the root, which shows every feature of the co-op''s layout: arrange the layout instead (arrange-features)'
    WHEN row_flaw.feature IS NULL AND NOT EXISTS (SELECT FROM circle.feature_group g WHERE g.id = row_flaw."group")
      THEN 'no group ' || coalesce(row_flaw."group", 'is named') || ' in the co-op''s layout: show one of '
        || coalesce((SELECT string_agg(g.id, ', ' ORDER BY g.position) FROM circle.feature_group g), 'none')
    WHEN row_flaw.feature IS NOT NULL AND NOT EXISTS (SELECT FROM circle.feature f WHERE f.feat = row_flaw.feature)
      THEN row_flaw.feature || ' is no feature of the co-op''s layout: hide one of '
        || coalesce((SELECT string_agg(f.feat, ', ' ORDER BY f.position) FROM circle.feature f), 'none')
  END
  FROM (SELECT row_flaw.circle AS circle) p
  LEFT JOIN circle.circle c ON c.id = p.circle;
END;

-- Whether the circle `decider` holds `arrange-features` over the circle
-- `subject` on `day`: a collective mandate in force for it whose scope
-- covers the subject (`circle.covers`), its own circle for `own`, the
-- circle it names, or every circle where it marks none. Unlike a
-- circle's name, purpose and procedure, which another circle decides
-- (`amend-circle`, `motion.decides`), a circle holding it over itself
-- chooses what it shows by its own motion.
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

-- circle:feature:arrange and circle:circle:arrange — the layout a holder
-- of `arrange-features` over the root wrote, at once or by the motion it
-- cites, is a sound listing of it, judged against what its entry says it
-- was (`circle.listing_flaw`), and the co-op has it now, its groups by the
-- ids its entry gives. Whether the actor holds the power over the root is
-- core's guard on every op with a power, by the circle the payload names
-- (`circle_person.empowered`); whether the motion's circle does, the
-- graft citing it.
CREATE FUNCTION circle.arranged(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    circle.listing_flaw(payload ->> 'circle', payload ->> 'features', payload ->> 'was'),
    CASE WHEN circle.features(payload ->> 'circle') IS DISTINCT FROM circle.spelt(payload ->> 'features')
      THEN 'the features of ' || (payload ->> 'circle') || ' are not ' || coalesce(payload ->> 'features', 'none') || ' as its entry says' END,
    CASE WHEN circle.groups() IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(payload -> 'groups'))
      THEN 'the co-op''s groups are ' || array_to_string(circle.groups(), ', ') || ', not ' || coalesce(payload ->> 'groups', 'none') || ' as its entry says' END
  );
END;

-- circle:group:show and circle:circle:show — the circle shows the group
-- its entry names, or does not, as its entry says (`shown`), at once by a
-- holder of `arrange-features` over the circle or by the motion it cites;
-- a sound row (`circle.row_flaw`). A row alone, never the whole listing:
-- two writes of rows commute, and two of one row leave the later.
CREATE FUNCTION circle.showed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    CASE WHEN jsonb_typeof(payload -> 'shown') IS DISTINCT FROM 'boolean'
      THEN 'a group is shown or not: say which, shown true or false' END,
    circle.row_flaw(payload ->> 'circle', payload ->> 'group', NULL),
    CASE WHEN EXISTS (SELECT FROM circle.shown s WHERE s.circle = payload ->> 'circle' AND s."group" = payload ->> 'group')
        IS DISTINCT FROM (payload ->> 'shown')::boolean
      THEN (payload ->> 'circle') || ' does not show ' || (payload ->> 'group') || ' as its entry says' END
  );
END;

-- circle:feature:hide and circle:circle:hide — the circle hides the
-- feature its entry names, or does not, as its entry says (`hidden`), as
-- `circle.showed` judges a group's row.
CREATE FUNCTION circle.hid(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    CASE WHEN jsonb_typeof(payload -> 'hidden') IS DISTINCT FROM 'boolean'
      THEN 'a feature is hidden or not: say which, hidden true or false' END,
    circle.row_flaw(payload ->> 'circle', NULL, coalesce(payload ->> 'feature', '')),
    CASE WHEN EXISTS (SELECT FROM circle.hidden h WHERE h.circle = payload ->> 'circle' AND h.feat = payload ->> 'feature')
        IS DISTINCT FROM (payload ->> 'hidden')::boolean
      THEN (payload ->> 'circle') || ' does not hide ' || (payload ->> 'feature') || ' as its entry says' END
  );
END;

-- A circle's row set as a write gives it: a group shown or not, a
-- feature hidden or not; none where the circle, the group or the feature
-- is none there is, for the guard to refuse. Its handler and its fold
-- write it alike.
CREATE FUNCTION circle.show(circle text, "group" text, shown boolean) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  DELETE FROM circle.shown s WHERE s.circle = show.circle AND s."group" = show."group" AND NOT show.shown;
  INSERT INTO circle.shown (circle, "group") SELECT show.circle, show."group" WHERE show.shown
    AND EXISTS (SELECT FROM circle.circle c WHERE c.id = show.circle) AND EXISTS (SELECT FROM circle.feature_group g WHERE g.id = show."group")
  ON CONFLICT DO NOTHING;
END;

CREATE FUNCTION circle.hide(circle text, feature text, hidden boolean) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  DELETE FROM circle.hidden h WHERE h.circle = hide.circle AND h.feat = hide.feature AND NOT hide.hidden;
  INSERT INTO circle.hidden (circle, feat) SELECT hide.circle, hide.feature WHERE hide.hidden
    AND EXISTS (SELECT FROM circle.circle c WHERE c.id = hide.circle) AND EXISTS (SELECT FROM circle.feature f WHERE f.feat = hide.feature)
  ON CONFLICT DO NOTHING;
END;

-- A holder's own write needs `arrange-features` over the circle its
-- payload names, by a mandate on a seat, the root's for the layout; a
-- motion's, `circle:circle:arrange`, `.show` and `.hide`, needs it as the
-- motion's circle's collective mandate, which the graft citing the
-- motion registers in `motion.cites`.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('circle:feature:arrange', 'arrange-features', NULL, 'circle'),
  ('circle:group:show', 'arrange-features', NULL, 'circle'),
  ('circle:feature:hide', 'arrange-features', NULL, 'circle');
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('circle:feature:arrange', 'circle.arranged(jsonb)', 'circle'),
  ('circle:circle:arrange', 'circle.arranged(jsonb)', 'circle'),
  ('circle:group:show', 'circle.showed(jsonb)', 'circle'),
  ('circle:circle:show', 'circle.showed(jsonb)', 'circle'),
  ('circle:feature:hide', 'circle.hid(jsonb)', 'circle'),
  ('circle:circle:hide', 'circle.hid(jsonb)', 'circle');

-- An arrangement lays the co-op's features out; a circle's write sets one
-- of its rows.
GRANT SELECT ON circle.feature_group, circle.feature, circle.shown, circle.hidden TO cella_app, cella_guards;
GRANT INSERT, UPDATE, DELETE ON circle.feature_group, circle.feature TO cella_app;
GRANT INSERT, DELETE ON circle.shown, circle.hidden TO cella_app;

-- The layout is the co-op's, read by everyone in it, as every sidebar
-- draws it; a circle's rows are the structure's, read as the circles are.
ALTER TABLE circle.feature_group ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY layout ON circle.feature_group TO cella_app USING (true) WITH CHECK (true);
CREATE POLICY layout_guards ON circle.feature_group FOR SELECT TO cella_guards USING (true);
ALTER TABLE circle.feature ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY layout ON circle.feature TO cella_app USING (true) WITH CHECK (true);
CREATE POLICY layout_guards ON circle.feature FOR SELECT TO cella_guards USING (true);
ALTER TABLE circle.shown ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.shown TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR circle = ANY ((SELECT circle.own())::text[])
    OR (SELECT circle.published('circles'))) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.shown FOR SELECT TO cella_guards USING (true);
ALTER TABLE circle.hidden ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.hidden TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR circle = ANY ((SELECT circle.own())::text[])
    OR (SELECT circle.published('circles'))) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.hidden FOR SELECT TO cella_guards USING (true);

-- circle:group:show and circle:circle:show, circle:feature:hide and
-- circle:circle:hide: the row its entry names set as it says, a seat's
-- write and a motion's fold the same.
CREATE FUNCTION circle.fold_show(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM circle.show(p ->> 'circle', p ->> 'group', (p ->> 'shown')::boolean);
END
$$;

CREATE FUNCTION circle.fold_hide(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM circle.hide(p ->> 'circle', p ->> 'feature', (p ->> 'hidden')::boolean);
END
$$;

SELECT cella.lets_fold('circle:group:show', 1, 'circle.fold_show(jsonb)', 'circle');
SELECT cella.lets_fold('circle:circle:show', 1, 'circle.fold_show(jsonb)', 'circle');
SELECT cella.lets_fold('circle:feature:hide', 1, 'circle.fold_hide(jsonb)', 'circle');
SELECT cella.lets_fold('circle:circle:hide', 1, 'circle.fold_hide(jsonb)', 'circle');
