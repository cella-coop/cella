-- Who reads the structure: core's circles, roles and grantees, the
-- mandates, rights and open books' values, the members and the tenures
-- are the members of the scope's, and so is the register of policies,
-- which core's graft `circle-policy` puts under the same test. A member
-- reads every row; anyone else signed in, their own seats, the
-- circles and roles they name, the mandates on those roles and the
-- parts the coop publishes by motion; no one
-- signed in, none. A write's
-- transaction and a superuser's session read the whole, and the guards
-- role every row.

-- Whether the reader is a member of the scope: they hold the member role,
-- seated in the assembly by a tenure running on the verdict date. It runs
-- as its owner, so a policy on the tenures asks it without reading them.
CREATE FUNCTION circle.inside() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
RETURN cella.reader() IS NOT NULL AND EXISTS (
  SELECT FROM circle.tenure t
  WHERE t.holder = cella.reader() AND t.role = 'member' AND t.circle = circle.assembly()
    AND (t.since IS NULL OR t.since <= cella.verdict_date())
    AND (t.until IS NULL OR t.until > cella.verdict_date())
);
-- The roles the reader's own seats hold, on any day: the role of each
-- tenure of theirs, and the participant role, which every seat holds,
-- where they hold any. It runs as its owner, as `inside` does, and says
-- nothing of anyone else's seats.
CREATE FUNCTION circle.held() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
RETURN ARRAY(
  SELECT t.role FROM circle.tenure t WHERE t.holder = cella.reader()
  UNION
  SELECT 'participant' FROM circle.seat p WHERE p.member = cella.reader()
  ORDER BY 1
);

-- The circles and roles the reader's own seats name, on any day, by id,
-- which circles and roles share: the circle of each seat of theirs, and
-- the roles they hold (`held`).
CREATE FUNCTION circle.own() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
RETURN ARRAY(
  SELECT p.circle FROM circle.seat p WHERE p.member = cella.reader()
  UNION
  SELECT unnest(circle.held())
  ORDER BY 1
);
-- Whether the coop publishes a part of its structure to the reader, who
-- is signed in: the one publication in force on the verdict date
-- (`circle.overlap_flaw`) names it. It runs as its owner, as `inside` does, and says no more than
-- whether.
CREATE FUNCTION circle.published(part text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
RETURN cella.reader() IS NOT NULL AND coalesce((
  SELECT published.part = ANY (o.parts) FROM circle.publication o
  WHERE o."from" <= cella.verdict_date()
    AND (o.until IS NULL OR o.until > cella.verdict_date())
    AND (o.revoked IS NULL OR o.revoked > cella.verdict_date())
  ORDER BY o."from" DESC, o.id DESC
  LIMIT 1
), false);

-- The coop's particulars in force on the verdict date: those of the one
-- rule standing then (`circle.overlap_flaw`), none where no rule stands.
-- It runs as its owner, so every reader reads them, signed in or not:
-- the coop's name and its mentions are what its every paper prints, and
-- its logo what the sign-in shows before anyone is signed in.
CREATE FUNCTION circle.particulars() RETURNS TABLE (policy text, name text, legal_name text, form text, capital text, siren text,
                                                    rcs text, vat text, seat text, logo text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT r.policy, r.name, r.legal_name, r.form, r.capital, r.siren, r.rcs, r.vat, r.seat, r.logo
  FROM circle.particulars r
  WHERE r."from" <= cella.verdict_date()
    AND (r.until IS NULL OR r.until > cella.verdict_date())
    AND (r.revoked IS NULL OR r.revoked > cella.verdict_date())
  ORDER BY r."from" DESC, r.id DESC
  LIMIT 1;
END;
COMMENT ON FUNCTION circle.particulars() IS 'audience: shared: the coop''s name and the mentions its every paper prints are no one''s to keep from a reader';

-- The assembly an application is made to, its name and the procedure
-- that decides it, which a person reads before they are a member.
CREATE FUNCTION circle.applied() RETURNS TABLE (id text, name text, procedure text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT c.id, c.name, c.procedure FROM circle.circle c WHERE c.assembly;
END;
COMMENT ON FUNCTION circle.applied() IS 'audience: shared: whoever may apply reads the assembly they apply to, its name and the procedure that decides an application, and nothing of who sits in it';

REVOKE EXECUTE ON FUNCTION circle.inside(), circle.held(), circle.own(), circle.published(text), circle.applied() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION circle.inside(), circle.held(), circle.own(), circle.published(text), circle.applied() TO cella_app, cella_guards;

-- Every table of the structure under row-level security, enabled and
-- forced: `structure` for the app role, which reads the whole in a
-- write's transaction, every row as a member, its own seats, what they
-- name and the mandates on its roles, and each part the coop publishes
-- (`published`); `structure_guards`, every row for the guards role.

ALTER TABLE circle.grantee ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.grantee TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR id = ANY ((SELECT circle.own())::text[])
    OR (kind = 'circle' AND (SELECT circle.published('circles'))) OR (kind = 'role' AND (SELECT circle.published('roles')))) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.grantee FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.circle ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.circle TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR id = ANY ((SELECT circle.own())::text[])
    OR (SELECT circle.published('circles'))) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.circle FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.role ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.role TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR id = ANY ((SELECT circle.own())::text[])
    OR (SELECT circle.published('roles'))) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.role FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.member ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.member TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR person = cella.reader() OR role = ANY ((SELECT circle.own())::text[])
    OR (SELECT circle.published('seats'))) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.member FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.tenure ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.tenure TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR holder = cella.reader()
    OR (SELECT circle.published('seats'))) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.tenure FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.mandate ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.mandate TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR grantee = ANY ((SELECT circle.held())::text[])
    OR (SELECT circle.published('mandates'))) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.mandate FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.right ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.right TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside())) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.right FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.disclosure ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.disclosure TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside())) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.disclosure FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.publication ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.publication TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside())) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.publication FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.particulars ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.particulars TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside())) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.particulars FOR SELECT TO cella_guards USING (true);

-- The settings and each circle's value of them are no one's secret:
-- every reader of a circle's records reads whether its comments take
-- reactions, as the thread draws them.
ALTER TABLE circle.setting ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY registry ON circle.setting TO cella_app USING (true) WITH CHECK (true);
CREATE POLICY registry_guards ON circle.setting FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.setting_value ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY registry ON circle.setting_value TO cella_app USING (true) WITH CHECK (true);
CREATE POLICY registry_guards ON circle.setting_value FOR SELECT TO cella_guards USING (true);
