-- A person reads their own record whatever they hold, beside core's
-- row-level policy, which reads every other by its owning circle: what is
-- theirs is theirs to read, as one just taken up their invitation reads
-- their own profile before any seat.
CREATE POLICY own ON person.person FOR SELECT TO cella_app USING (address = cella.reader());
