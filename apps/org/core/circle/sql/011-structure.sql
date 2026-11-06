-- Who reads the structure: core's circles, roles and grantees, the
-- mandates, rights and open books' values, the members and the tenures,
-- and the register of policies are the members of the scope's. A member
-- reads every row; anyone else signed in, their own seats, the
-- circles and roles they name, and the mandates on those roles; no one
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
-- The assembly an application is made to, its name and the procedure
-- that decides it, which a person reads before they are a member.
CREATE FUNCTION circle.applied() RETURNS TABLE (id text, name text, procedure text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT c.id, c.name, c.procedure FROM circle.circle c WHERE c.assembly;
END;
COMMENT ON FUNCTION circle.applied() IS 'audience: shared: whoever may apply reads the assembly they apply to, its name and the procedure that decides an application, and nothing of who sits in it';

REVOKE EXECUTE ON FUNCTION circle.inside(), circle.held(), circle.own(), circle.applied() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION circle.inside(), circle.held(), circle.own(), circle.applied() TO cella_app, cella_guards;

-- Every table of the structure under row-level security, enabled and
-- forced: `structure` for the app role, which reads the whole in a
-- write's transaction, every row as a member, and its own seats, what
-- they name and the mandates on its roles; `structure_guards`, every row
-- for the guards role.

ALTER TABLE circle.grantee ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.grantee TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR id = ANY ((SELECT circle.own())::text[])) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.grantee FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.circle ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.circle TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR id = ANY ((SELECT circle.own())::text[])) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.circle FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.role ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.role TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR id = ANY ((SELECT circle.own())::text[])) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.role FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.member ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.member TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR person = cella.reader() OR role = ANY ((SELECT circle.own())::text[])) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.member FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.tenure ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.tenure TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR holder = cella.reader()) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.tenure FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.mandate ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.mandate TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR grantee = ANY ((SELECT circle.held())::text[])) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.mandate FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.right ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.right TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside())) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.right FOR SELECT TO cella_guards USING (true);

ALTER TABLE circle.disclosure ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON circle.disclosure TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside())) WITH CHECK (true);
CREATE POLICY structure_guards ON circle.disclosure FOR SELECT TO cella_guards USING (true);

ALTER TABLE policy.policy ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON policy.policy TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside())) WITH CHECK (true);
CREATE POLICY structure_guards ON policy.policy FOR SELECT TO cella_guards USING (true);

ALTER TABLE policy.wording ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON policy.wording TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside())) WITH CHECK (true);
CREATE POLICY structure_guards ON policy.wording FOR SELECT TO cella_guards USING (true);

ALTER TABLE policy.value ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON policy.value TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside())) WITH CHECK (true);
CREATE POLICY structure_guards ON policy.value FOR SELECT TO cella_guards USING (true);

-- A legal form and its defaults are the same in every scope: registries
-- every reader reads.
ALTER TABLE policy.form ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE policy.default ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY registry ON policy.form TO cella_app USING (true) WITH CHECK (true);
CREATE POLICY registry_guards ON policy.form FOR SELECT TO cella_guards USING (true);
CREATE POLICY registry ON policy.default TO cella_app USING (true) WITH CHECK (true);
CREATE POLICY registry_guards ON policy.default FOR SELECT TO cella_guards USING (true);

-- A policy's legal wording as it reads, quoted by `policy.says` to a
-- guard in the reason it refuses, and to whoever reads the register: it
-- runs as its owner, since the guards role reads no wording, so it asks
-- the structure's test itself, which the register knows no circle to
-- ask. A write's transaction, where every guard runs, and a member of
-- the scope read it; anyone else, null.
CREATE OR REPLACE FUNCTION policy.says(ref text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
RETURN (
  SELECT policy.sentence(w.legal) FROM policy.wording w
  WHERE w.policy = says.ref AND ((SELECT circle.whole()) OR (SELECT circle.inside()))
);
