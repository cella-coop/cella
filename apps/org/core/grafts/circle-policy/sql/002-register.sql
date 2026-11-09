ALTER TABLE policy.policy ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON policy.policy TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR (SELECT circle.published('register'))) WITH CHECK (true);
CREATE POLICY structure_guards ON policy.policy FOR SELECT TO cella_guards USING (true);

ALTER TABLE policy.wording ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON policy.wording TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR (SELECT circle.published('register'))) WITH CHECK (true);
CREATE POLICY structure_guards ON policy.wording FOR SELECT TO cella_guards USING (true);

ALTER TABLE policy.value ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON policy.value TO cella_app
  USING ((SELECT circle.whole()) OR (SELECT circle.inside()) OR (SELECT circle.published('register'))) WITH CHECK (true);
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

-- A policy's legal wording as it reads, quoted to a guard in the reason
-- it refuses and to whoever reads the register: the register's own
-- `policy.says` reads it, which no role may call but through this, and
-- this asks the structure's test first, which the register knows no
-- circle to ask. A write's transaction, where every guard runs, a member
-- of the scope, and anyone signed in while the co-op publishes its
-- register read it; anyone else, null. It runs as its owner, since the
-- guards role reads no wording.
CREATE FUNCTION circle_policy.says(ref text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
RETURN CASE WHEN (SELECT circle.whole()) OR (SELECT circle.inside()) OR (SELECT circle.published('register')) THEN policy.says(ref) END;

REVOKE EXECUTE ON FUNCTION circle_policy.says(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION circle_policy.says(text) TO cella_app, cella_guards;
