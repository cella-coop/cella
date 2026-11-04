-- A person reads their own membership and invitation whatever they hold,
-- beside core's row-level policy, which reads every other by its owning
-- circle.
CREATE POLICY own ON membership.member FOR SELECT TO cella_app USING (address = cella.reader());
CREATE POLICY own ON membership.invitation FOR SELECT TO cella_app USING (member = cella.reader());
