-- A mandate is a policy's: a sentence a circle adopted by motion, marking
-- its grantee, the role it grants to or the circle for a collective
-- mandate, the power, and perhaps a limit per write or a budget over a
-- month or a year. A right is a policy of its own kind, no mandate: the
-- power the legal form gives every person, member or employee as such,
-- with no grantee. The circles know no policy but by its id: core's graft
-- joining them to the register, `circle-policy`, reads a policy's values
-- as it is adopted and issues them by the writes below, `circle.issue`,
-- `circle.give`, `circle.disclose` and `circle.publish`, in the same
-- write, and revokes them as it ends or is replaced, `circle.withdraw`.


-- The mandate a mandate of these values, issued by `issuer` from the day
-- `from`, would be issued under, or null: none where the issuer is the
-- assembly, whose mandates are roots; else the first of the issuer's
-- mandates for the power, standing on that day, that the values are
-- narrower than (`circle.wider`), or the first standing at all, which
-- `circle.narrows` then refuses saying how it is wider; never one of
-- `besides`, the policy itself and the one it replaces. So a grant is
-- judged before its policy exists, as the motion feat's form asks, by
-- the SQL that finds its parent as it is adopted.
CREATE FUNCTION circle.parent_for(
  issuer text, power text, "limit" cella.amount, budget cella.amount, per text, scope text, "from" date, until date, besides text[] DEFAULT '{}'
) RETURNS bigint
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT u.id
  FROM circle.mandate u
  WHERE u.grantee = parent_for.issuer AND u.power = parent_for.power
    AND NOT coalesce(u.policy = ANY (parent_for.besides), false)
    AND parent_for.issuer IS DISTINCT FROM circle.assembly()
    AND (u.revoked IS NULL OR u.revoked > parent_for."from")
    AND (u.until IS NULL OR u.until > parent_for."from")
  ORDER BY circle.wider(parent_for.power, parent_for."limit", parent_for.budget, parent_for.per, parent_for.scope,
                        parent_for."from", parent_for.until, u.id) IS NULL DESC, u.id
  LIMIT 1;
END;

-- What is wrong with a disclosure rule, a publication or the particulars applying from
-- `day`, perhaps until `until`, and replacing `replaces`, or null: one of
-- each stands at a time, so one whose days meet those of another of its
-- kind not yet revoked by then replaces that one, and the refusal names
-- it. `made` is the rule itself, once adopted. `what` is `disclosure`,
-- `publication` or `particulars`.
CREATE FUNCTION circle.overlap_flaw(what text, day date, until date, replaces text, made text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT o.policy || CASE overlap_flaw.what WHEN 'disclosure' THEN ' sets open books'' disclosure values'
                         WHEN 'particulars' THEN ' sets the coop''s particulars' ELSE ' publishes parts of the structure' END
    || ' from ' || to_char(o."from", 'YYYY-MM-DD') || coalesce(' until ' || to_char(o.ends, 'YYYY-MM-DD'), '')
    || ': one ' || CASE overlap_flaw.what WHEN 'disclosure' THEN 'disclosure rule' WHEN 'particulars' THEN 'particulars rule' ELSE 'publication' END
    || ' stands at a time, so one on days that meet its replaces ' || o.policy
  FROM (
    SELECT d.id, d.policy, d."from", least(d.until, d.revoked) AS ends FROM circle.disclosure d WHERE overlap_flaw.what = 'disclosure'
    UNION ALL
    SELECT p.id, p.policy, p."from", least(p.until, p.revoked) FROM circle.publication p WHERE overlap_flaw.what = 'publication'
    UNION ALL
    SELECT r.id, r.policy, r."from", least(r.until, r.revoked) FROM circle.particulars r WHERE overlap_flaw.what = 'particulars'
  ) o
  WHERE o.policy IS DISTINCT FROM overlap_flaw.replaces AND o.policy IS DISTINCT FROM overlap_flaw.made
    AND (o.ends IS NULL OR o.ends > overlap_flaw.day)
    AND (overlap_flaw.until IS NULL OR o."from" < overlap_flaw.until)
    AND (o.ends IS NULL OR o."from" < o.ends)
  ORDER BY o."from", o.id
  LIMIT 1;
END;

-- Open books' disclosure values in force on a day: those of the one
-- rule standing then (`circle.overlap_flaw`), none where no rule stands.
CREATE FUNCTION circle.disclosed(day date) RETURNS TABLE (policy text, contributors integer, largest numeric, two numeric)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT d.policy, d.contributors, d.largest, d.two
  FROM circle.disclosure d
  WHERE d."from" <= disclosed.day
    AND (d.until IS NULL OR d.until > disclosed.day)
    AND (d.revoked IS NULL OR d.revoked > disclosed.day)
  ORDER BY d."from" DESC, d.id DESC
  LIMIT 1;
END;

-- The parts a publication's literal names, in its order: a list by
-- commas and a last `and`, each trimmed and in lower case.
CREATE FUNCTION circle.parts(literal text) RETURNS text[]
LANGUAGE sql IMMUTABLE
RETURN ARRAY(
  SELECT btrim(t.p)
  FROM regexp_split_to_table(lower(coalesce(literal, '')), '\s*,\s*(and\s+)?|\s+and\s+') WITH ORDINALITY AS t(p, n)
  WHERE btrim(t.p) <> ''
  ORDER BY t.n
);

-- What is wrong with the publication, by its marks as written, each name
-- with its literal (`{"publish": {"literal": "circles and roles"}}`), and
-- the circle adopting it, or null: null too for a rule marking no
-- `publish`. It is the assembly's,
-- marks `publish` and nothing else, and names at least one part, each
-- of circles, roles, mandates, seats and register.
CREATE FUNCTION circle.publication_flaw(marks jsonb, issuer text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT coalesce(marks, '{}') ? 'publish' THEN NULL
    WHEN issuer IS DISTINCT FROM circle.assembly()
      THEN 'what of its structure the coop publishes is the assembly''s: only a motion of the assembly adopts it'
    WHEN x.other IS NOT NULL
      THEN 'a publication marks publish and nothing else, not ' || x.other
    WHEN cardinality(x.parts) = 0
      THEN 'a publication names what it publishes, any of circles, roles, mandates, seats and register, as {publish: circles and roles}'
    WHEN x.unknown IS NOT NULL
      THEN 'a publication publishes any of circles, roles, mandates, seats and register, as {publish: circles and roles}, not ' || x.unknown
  END
  FROM (
    SELECT v.parts,
           (SELECT k FROM jsonb_object_keys(coalesce(marks, '{}')) k WHERE k <> 'publish' ORDER BY k LIMIT 1) AS other,
           (SELECT u.p FROM unnest(v.parts) WITH ORDINALITY AS u(p, n)
            WHERE u.p <> ALL (ARRAY['circles', 'roles', 'mandates', 'seats', 'register']) ORDER BY u.n LIMIT 1) AS unknown
    FROM (SELECT circle.parts(marks #>> '{publish,literal}') AS parts) v
  ) x;
END;

-- The particulars a rule names: the nine values it may mark, each by
-- its name in the rule and its column.
CREATE FUNCTION circle.particular_names() RETURNS text[]
LANGUAGE sql IMMUTABLE
RETURN ARRAY['particulars_name', 'particulars_legal_name', 'particulars_form', 'particulars_capital',
             'particulars_siren', 'particulars_rcs', 'particulars_vat', 'particulars_seat', 'particulars_logo'];

-- What is wrong with an XML document as its parser reads it, or null
-- when it is one: well formed, each prefix it uses declared. The reason
-- is the parser's, its first line, as `AttValue: " or ' expected`.
CREATE FUNCTION circle.xml_flaw(doc text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  why text;
BEGIN
  PERFORM xpath('/*', xmlparse(document doc));
  RETURN NULL;
EXCEPTION WHEN invalid_xml_document THEN
  GET STACKED DIAGNOSTICS why = PG_EXCEPTION_DETAIL;
  RETURN coalesce(nullif(regexp_replace(split_part(why, E'\n', 1), '^line [0-9]+: ', ''), ''), 'it does not parse');
END
$$;

-- What is wrong with a coop's logo, an SVG as its rule marks it, or
-- null. The shell draws it only as an image, where no script runs and
-- nothing outside it loads; this refuses what would matter anywhere else
-- too, should the text be served or opened as a document: one `<svg>`
-- element of at most 4096 characters, an XML document that parses with
-- each prefix declared, declaring nothing (`<!…>`, `<?…>`), escaping no
-- character (`&#…;`, `\`), and, read as XML whatever the prefix, with
-- no element named `script` or `foreignObject`, no attribute named
-- `on…`, no `javascript:`, and no reference outside itself: no base
-- (`xml:base`) to resolve a reference against, every
-- attribute named `href`, `xlink:href` among them, and every `url()`
-- names only `#…`, no style imports (`@import`) or picks an image
-- (`image-set`), and no animation sets an `href`.
CREATE FUNCTION circle.logo_flaw(svg text) RETURNS text
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN length(svg) > 4096
      THEN 'a coop''s logo is an SVG of at most 4096 characters, not ' || length(svg)
    WHEN svg !~* '^<svg[\s>]' OR svg !~* '</svg>$'
      THEN 'a coop''s logo is one SVG, from <svg to </svg>'
    WHEN svg ~ '<[!?]'
      THEN 'a coop''s logo declares nothing: drop its ' || substring(svg from '<[!?][^>]{0,30}')
    WHEN x.malformed IS NOT NULL
      THEN 'a coop''s logo is well-formed XML, each element closed, each attribute quoted and each prefix declared, as <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">, not: ' || x.malformed
    WHEN svg ~ '&#|\\'
      THEN 'a coop''s logo writes each character as itself: drop its ' || substring(svg from '&#[^;]{0,10};?|\\.{0,6}')
    WHEN x.script IS NOT NULL
      THEN 'a coop''s logo runs no script: drop its <' || x.script || '>'
    WHEN x.html IS NOT NULL
      THEN 'a coop''s logo embeds no HTML: drop its <' || x.html || '>'
    WHEN x.handler IS NOT NULL
      THEN 'a coop''s logo handles no event: drop its ' || x.handler || '=…'
    WHEN svg ~* 'javascript\s*:'
      THEN 'a coop''s logo links nowhere: drop its javascript:'
    WHEN x.base IS NOT NULL
      THEN 'a coop''s logo resolves its references against itself: drop its ' || x.base || '=…'
    WHEN x.href IS NOT NULL
      THEN 'a coop''s logo references only its own parts, as href="#flame", not href="' || left(x.href, 40) || '"'
    WHEN svg ~* 'url\(\s*(?!["'']?#)'
      THEN 'a coop''s logo references only its own parts, as url(#glow), not ' || substring(svg from '(?i)url\([^)]{0,40}\)?')
    WHEN svg ~* '@import|image-set'
      THEN 'a coop''s logo loads nothing from outside itself: drop its ' || substring(svg from '(?i)@import|[-a-z]*image-set')
    WHEN x.animated
      THEN 'a coop''s logo animates no reference: drop the animation of its href'
  END
  FROM (
    SELECT p.malformed,
           nullif((xpath('name((//*[translate(local-name(), ''SCRIPT'', ''script'') = ''script''])[1])', d.doc))[1]::text, '') AS script,
           nullif((xpath('name((//*[translate(local-name(), ''FOREIGNOBJECT'', ''foreignobject'') = ''foreignobject''])[1])', d.doc))[1]::text, '') AS html,
           nullif((xpath('name((//@*[starts-with(translate(local-name(), ''ON'', ''on''), ''on'')])[1])', d.doc))[1]::text, '') AS handler,
           nullif((xpath('name((//@*[local-name() = ''base''])[1])', d.doc))[1]::text, '') AS base,
           (xpath('(//@*[local-name() = ''href'' and not(starts-with(., ''#''))])[1]', d.doc))[1]::text AS href,
           xpath_exists('//@*[local-name() = ''attributeName''
                              and (normalize-space(.) = ''href'' or substring-after(normalize-space(.), '':'') = ''href'')]', d.doc) AS animated
    FROM (SELECT circle.xml_flaw(svg) AS malformed) p
    CROSS JOIN LATERAL (SELECT CASE WHEN p.malformed IS NULL THEN xmlparse(document svg) END AS doc) d
  ) x;
END;

-- What is wrong with the particulars, by their marks as written, each name
-- with its literal (`{"particulars_name": {"literal": "Lanterne"}}`), and
-- the circle adopting them, or null: null too for a rule marking none of
-- them. They are the assembly's, mark `particulars_name` and nothing but
-- the nine, a SIREN marked is nine digits, spaces aside, and a logo
-- marked is one `circle.logo_flaw` passes.
CREATE FUNCTION circle.particulars_flaw(marks jsonb, issuer text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (SELECT FROM jsonb_object_keys(coalesce(marks, '{}')) k WHERE k = ANY (circle.particular_names())) THEN NULL
    WHEN issuer IS DISTINCT FROM circle.assembly()
      THEN 'the coop''s particulars are the assembly''s: only a motion of the assembly adopts them'
    WHEN x.other IS NOT NULL
      THEN 'the coop''s particulars mark any of ' || array_to_string(circle.particular_names(), ', ') || ' and nothing else, not ' || x.other
    WHEN coalesce(marks #>> '{particulars_name,literal}', '') !~ '\S'
      THEN 'the coop''s particulars name it, as {particulars_name: Lanterne}'
    WHEN marks ? 'particulars_siren' AND translate(marks #>> '{particulars_siren,literal}', E'   ', '') !~ '^[0-9]{9}$'
      THEN 'a SIREN is nine digits, as {particulars_siren: 123 456 789}, not ' || coalesce(marks #>> '{particulars_siren,literal}', 'none')
    WHEN marks ? 'particulars_logo' THEN circle.logo_flaw(marks #>> '{particulars_logo,literal}')
  END
  FROM (
    SELECT (SELECT k FROM jsonb_object_keys(coalesce(marks, '{}')) k
            WHERE k <> ALL (circle.particular_names()) ORDER BY k LIMIT 1) AS other
  ) x;
END;

-- Whether a circle holds a collective mandate in force for a power on a
-- day: a mandate whose grantee is the circle itself, never one on a
-- circle above or below it, nor one on any of its roles. Only a motion of
-- that circle uses it, which the graft joining this feat to motions
-- checks.
CREATE FUNCTION circle.holds(circle text, power text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle.mandate m
    JOIN circle.grantee g ON g.id = m.grantee AND g.kind = 'circle'
    WHERE m.grantee = holds.circle
      AND m.power = holds.power
      AND (m."from" IS NULL OR m."from" <= holds.day)
      AND (m.until IS NULL OR m.until > holds.day)
      AND (m.revoked IS NULL OR m.revoked > holds.day)
  );
END;

-- Why the assembly would not keep a collective `adopt-policy` mandate
-- in force on the verdict date with no `until` once the policies
-- `ending` end and the mandate policies `adopting` are adopted, or null
-- when it would: it keeps one it holds, never revoked, whose `from` is on
-- or before the verdict date and whose policy is none of `ending`, or one
-- of `adopting`, each the values its policy marks and its `from` and
-- `until`, if any, granting it with no `until` and no `from` after the
-- verdict date. One that applies only from a later day keeps nothing
-- until then, so a replacement leaves no day without one. Through it the
-- assembly grants itself again any power it ended. The reason names the
-- last such mandate in force it holds, the one the write or the motion
-- ends.
CREATE FUNCTION circle.sovereignty(ending text[], adopting jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT circle.assembly() || ' would lose its power to adopt policies: '
    || coalesce('mandate ' || l.id || ' of ' || l.policy || ' is its last collective adopt-policy mandate in force with no until',
         'it holds no collective adopt-policy mandate in force with no until')
    || '; adopting another with no from and no until in its place, in the same motion and before ending it, keeps it'
  FROM (SELECT) x
  LEFT JOIN LATERAL (
    SELECT m.id, m.policy FROM circle.mandate m
    WHERE m.grantee = circle.assembly() AND m.power = 'adopt-policy' AND m.until IS NULL
      AND (m."from" IS NULL OR m."from" <= cella.verdict_date())
    ORDER BY m.policy = ANY (coalesce(sovereignty.ending, '{}')) DESC, m.revoked DESC NULLS FIRST, m.id DESC
    LIMIT 1
  ) l ON true
  WHERE NOT EXISTS (
      SELECT FROM circle.mandate m
      WHERE m.grantee = circle.assembly() AND m.power = 'adopt-policy'
        AND m.until IS NULL AND m.revoked IS NULL
        AND (m."from" IS NULL OR m."from" <= cella.verdict_date())
        AND m.policy <> ALL (coalesce(sovereignty.ending, '{}'))
    )
    AND NOT EXISTS (
      SELECT FROM jsonb_array_elements(coalesce(sovereignty.adopting, '[]')) a
      WHERE a ->> 'circle' = circle.assembly() AND a ->> 'power' = 'adopt-policy'
        AND nullif(a ->> 'until', '') IS NULL
        AND (nullif(a ->> 'from', '') IS NULL OR (a ->> 'from')::date <= cella.verdict_date())
    );
END;

-- Whether the policy `ref` grants the assembly a collective
-- `adopt-policy` mandate with no `until` that stands on the verdict
-- date, revoked by no earlier day: one whose end or replacement
-- `circle.sovereignty` judges.
CREATE FUNCTION circle.sovereign_by(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle.mandate m
    WHERE m.policy = sovereign_by.ref
      AND m.grantee = circle.assembly() AND m.power = 'adopt-policy' AND m.until IS NULL
      AND (m.revoked IS NULL OR m.revoked >= cella.verdict_date())
  );
END;

-- Issues the mandate the policy `ref` grants, with its values, the
-- circle that adopted it, `issuer`, and the mandate it is issued under,
-- `parent`. Returns it.
CREATE FUNCTION circle.issue(
  ref text, grantee text, issuer text, parent bigint, power text, "limit" cella.amount, budget cella.amount,
  per text, procedure text, scope text, "from" date, until date
) RETURNS bigint
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO circle.mandate (grantee, issuer, parent, power, policy, "limit", budget, per, procedure, scope, "from", until)
  VALUES (issue.grantee, issue.issuer, issue.parent, issue.power, issue.ref, issue."limit", issue.budget, issue.per,
          issue.procedure, issue.scope, issue."from", issue.until)
  RETURNING id;
END;

-- Gives the right the policy `ref` gives, with its values. Returns it.
CREATE FUNCTION circle.give(ref text, "right" text, power text, "limit" cella.amount, "from" date, until date) RETURNS bigint
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO circle.right ("right", power, policy, "limit", "from", until)
  VALUES (give."right", give.power, give.ref, give."limit", give."from", give.until)
  RETURNING id;
END;

-- Sets open books' disclosure values the rule `ref` marks, on its days.
-- Returns the row it made.
CREATE FUNCTION circle.disclose(ref text, contributors integer, largest numeric, two numeric, "from" date, until date) RETURNS bigint
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO circle.disclosure (policy, contributors, largest, two, "from", until)
  VALUES (disclose.ref, disclose.contributors, disclose.largest, disclose.two, disclose."from", disclose.until)
  RETURNING id;
END;

-- Publishes the parts of the structure the rule `ref` names, on its
-- days. Returns the row it made.
CREATE FUNCTION circle.publish(ref text, parts text[], "from" date, until date) RETURNS bigint
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO circle.publication (policy, parts, "from", until)
  VALUES (publish.ref, publish.parts, publish."from", publish.until)
  RETURNING id;
END;

-- Sets the coop's particulars the rule `ref` marks, on its days, each
-- as written, a value it marks not being null. Returns the row it made.
CREATE FUNCTION circle.particularise(ref text, name text, legal_name text, form text, capital text, siren text, rcs text,
                                     vat text, seat text, logo text, "from" date, until date) RETURNS bigint
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO circle.particulars (policy, name, legal_name, form, capital, siren, rcs, vat, seat, logo, "from", until)
  VALUES (particularise.ref, particularise.name, particularise.legal_name, particularise.form, particularise.capital,
          particularise.siren, particularise.rcs, particularise.vat, particularise.seat, particularise.logo,
          particularise."from", particularise.until)
  RETURNING id;
END;

-- Revokes on `day` what the policy `ref` granted that is not revoked
-- yet: its right, its disclosure values, its publication, its
-- particulars and its setting value, and its
-- mandate with every mandate issued under it that still stands then
-- (`circle.revoke`). Returns the mandate, or null, and the mandates it
-- revoked, the policy's first.
CREATE FUNCTION circle.withdraw(ref text, day date) RETURNS TABLE (mandate bigint, revoked bigint[])
LANGUAGE plpgsql AS $$
DECLARE
  made bigint;
  gone bigint[];
BEGIN
  UPDATE circle.disclosure d SET revoked = day WHERE d.policy = ref AND d.revoked IS NULL;
  UPDATE circle.publication o SET revoked = day WHERE o.policy = ref AND o.revoked IS NULL;
  UPDATE circle.particulars o SET revoked = day WHERE o.policy = ref AND o.revoked IS NULL;
  UPDATE circle.setting_value o SET revoked = day WHERE o.policy = ref AND o.revoked IS NULL;
  UPDATE circle.right r SET revoked = day WHERE r.policy = ref AND r.revoked IS NULL;
  SELECT m.id, circle.revoke(m.id, day) INTO made, gone FROM circle.mandate m WHERE m.policy = ref;
  RETURN QUERY SELECT made, coalesce(gone, '{}');
END
$$;

-- Pins the id the next mandate issued takes, as a fold replaying an
-- entry that issued one takes its id from the entry.
CREATE FUNCTION circle.pin_mandate(id bigint) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT setval(pg_get_serial_sequence('circle.mandate', 'id'), pin_mandate.id, false);
END;

-- Registers a setting a slice offers, from its migration: its name, its
-- default, `on` or `off`, and the slice. A setting registered again takes
-- the default and owner given.
CREATE FUNCTION circle.register_setting(name text, "default" text, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO circle.setting (name, "default", owner)
  VALUES (register_setting.name, register_setting."default", register_setting.owner)
  ON CONFLICT (name) DO UPDATE SET "default" = excluded."default", owner = excluded.owner;
END;

REVOKE EXECUTE ON FUNCTION circle.register_setting(text, text, text) FROM PUBLIC;

-- A circle's value of a setting a rule of it set, standing on a day:
-- the one rule's whose days hold it and that is not revoked by then.
CREATE FUNCTION circle.set_on(circle text, setting text, day date) RETURNS TABLE (policy text, value text)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT v.policy, v.value
  FROM circle.setting_value v
  WHERE v.circle = set_on.circle AND v.setting = set_on.setting
    AND v."from" <= set_on.day
    AND (v.until IS NULL OR v.until > set_on.day)
    AND (v.revoked IS NULL OR v.revoked > set_on.day)
  ORDER BY v."from" DESC, v.id DESC
  LIMIT 1;
END;

-- Each setting as a circle has it on the verdict date: its value, the
-- rule that set it and who did, `circle` where the circle's own rule did,
-- `assembly` where the assembly's did, which every circle inherits, since
-- circles never nest, and `default` where neither did; in the order of
-- their names.
CREATE FUNCTION circle.settings(circle text) RETURNS TABLE (name text, value text, policy text, set_by text, "default" text)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT s.name, coalesce(o.value, a.value, s."default"), coalesce(o.policy, a.policy),
    CASE WHEN o.policy IS NOT NULL THEN 'circle' WHEN a.policy IS NOT NULL THEN 'assembly' ELSE 'default' END,
    s."default"
  FROM circle.setting s
  LEFT JOIN LATERAL circle.set_on(settings.circle, s.name, cella.verdict_date()) o ON true
  LEFT JOIN LATERAL circle.set_on(circle.assembly(), s.name, cella.verdict_date()) a ON settings.circle IS DISTINCT FROM circle.assembly()
  ORDER BY s.name;
END;

-- A circle's value of a setting on the verdict date: its own rule's,
-- else the assembly's, else the setting's default; null for a setting no
-- slice registered. A guard reads a setting by this alone.
CREATE FUNCTION circle.setting_of(circle text, name text) RETURNS text
LANGUAGE sql STABLE
RETURN (SELECT s.value FROM circle.settings(setting_of.circle) s WHERE s.name = setting_of.name);

-- Sets a circle's value of a setting the rule `ref` marks, on its days.
-- Returns the row it made.
CREATE FUNCTION circle.set_setting(ref text, circle text, setting text, value text, "from" date, until date) RETURNS bigint
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO circle.setting_value (policy, circle, setting, value, "from", until)
  VALUES (set_setting.ref, set_setting.circle, set_setting.setting, set_setting.value, set_setting."from", set_setting.until)
  RETURNING id;
END;

-- What is wrong with a rule setting `setting` for `circle` from `day`,
-- perhaps until `until`, and replacing `replaces`, or null: one rule sets
-- a setting for a circle at a time, so one whose days meet those of
-- another not yet revoked by then replaces that one, and the refusal
-- names it. `made` is the rule itself, once adopted.
CREATE FUNCTION circle.setting_overlap(circle text, setting text, day date, until date, replaces text, made text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT o.policy || ' sets ' || o.setting || ' ' || o.value || ' for ' || o.circle
    || ' from ' || to_char(o."from", 'YYYY-MM-DD') || coalesce(' until ' || to_char(least(o.until, o.revoked), 'YYYY-MM-DD'), '')
    || ': one rule sets a setting for a circle at a time, so one on days that meet its replaces ' || o.policy
  FROM circle.setting_value o
  WHERE o.circle = setting_overlap.circle AND o.setting = setting_overlap.setting
    AND o.policy IS DISTINCT FROM setting_overlap.replaces AND o.policy IS DISTINCT FROM setting_overlap.made
    AND (least(o.until, o.revoked) IS NULL OR least(o.until, o.revoked) > setting_overlap.day)
    AND (setting_overlap.until IS NULL OR o."from" < setting_overlap.until)
    AND (least(o.until, o.revoked) IS NULL OR o."from" < least(o.until, o.revoked))
  ORDER BY o."from", o.id
  LIMIT 1;
END;

-- The first setting: whether a circle's comments take reactions, on by
-- default. Core circle registers it, since core body, whose threads draw
-- them, has no SQL.
SELECT circle.register_setting('reactions', 'on', 'circle');
