-- A worker reads their own candidacy whatever they hold, beside core's
-- row-level policy, which reads every other by its owning circle.
CREATE POLICY own ON employment_membership.candidacy FOR SELECT TO cella_app USING (worker = cella.reader());
