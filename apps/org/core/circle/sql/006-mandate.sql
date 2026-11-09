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

-- What is wrong with a disclosure rule or a publication applying from
-- `day`, perhaps until `until`, and replacing `replaces`, or null: one of
-- each stands at a time, so one whose days meet those of another of its
-- kind not yet revoked by then replaces that one, and the refusal names
-- it. `made` is the rule itself, once adopted. `what` is `disclosure` or
-- `publication`.
CREATE FUNCTION circle.overlap_flaw(what text, day date, until date, replaces text, made text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT o.policy || CASE overlap_flaw.what WHEN 'disclosure' THEN ' sets open books'' disclosure values' ELSE ' publishes parts of the structure' END
    || ' from ' || to_char(o."from", 'YYYY-MM-DD') || coalesce(' until ' || to_char(o.ends, 'YYYY-MM-DD'), '')
    || ': one ' || CASE overlap_flaw.what WHEN 'disclosure' THEN 'disclosure rule' ELSE 'publication' END
    || ' stands at a time, so one on days that meet its replaces ' || o.policy
  FROM (
    SELECT d.id, d.policy, d."from", least(d.until, d.revoked) AS ends FROM circle.disclosure d WHERE overlap_flaw.what = 'disclosure'
    UNION ALL
    SELECT p.id, p.policy, p."from", least(p.until, p.revoked) FROM circle.publication p WHERE overlap_flaw.what = 'publication'
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
      THEN 'what of its structure the co-op publishes is the assembly''s: only a motion of the assembly adopts it'
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

-- Revokes on `day` what the policy `ref` granted that is not revoked
-- yet: its right, its disclosure values and its publication, and its
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
