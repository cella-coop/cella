-- A worker reads their own contract whatever they hold, beside core's
-- row-level policy, which reads every other by its owning circle, so one
-- hired and seated nowhere yet reads their own employment.
CREATE POLICY own ON employment.worker FOR SELECT TO cella_app USING (address = cella.reader());
