-- circle-person, core's graft joining the circles to the people: every
-- person and every device names its owning circle, `circle`, as every
-- record does, the assembly's unless the write that makes it names
-- another, and is read by it. The people, knowing no circle, name it as
-- text and put their tables under no row-level policy of the circles';
-- this graft binds the column to core's circles, a foreign key into
-- circle.circle and the assembly by default, and puts the tables under
-- the policies the circles put a slice's tables under as they are made
-- (`circle.scoped`). Neither feat knows the other; this graft touches
-- nothing else of either, and its own schema, named for it, holds
-- nothing yet.

CREATE SCHEMA circle_person;

ALTER TABLE person.person
  ALTER COLUMN circle SET DEFAULT circle.assembly(),
  ADD FOREIGN KEY (circle) REFERENCES circle.circle;

ALTER TABLE person.device
  ALTER COLUMN circle SET DEFAULT circle.assembly(),
  ADD FOREIGN KEY (circle) REFERENCES circle.circle;

-- A person and a device read by their owning circle; a write's
-- transaction sees the whole, and the guards role reads the whole.
ALTER TABLE person.person ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY circle ON person.person TO cella_app
  USING ((SELECT cella.sees('person')) OR circle = ANY ((SELECT circle.reads('{person}'))::text[])) WITH CHECK (true);
CREATE POLICY circle_guards ON person.person FOR SELECT TO cella_guards USING (true);

ALTER TABLE person.device ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY circle ON person.device TO cella_app
  USING ((SELECT cella.sees('person')) OR circle = ANY ((SELECT circle.reads('{person}'))::text[])) WITH CHECK (true);
CREATE POLICY circle_guards ON person.device FOR SELECT TO cella_guards USING (true);

-- Who holds each right is a registry, the same in every scope, which
-- every reader reads.
ALTER TABLE person.rights ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY registry ON person.rights TO cella_app USING (true) WITH CHECK (true);
CREATE POLICY registry_guards ON person.rights FOR SELECT TO cella_guards USING (true);
