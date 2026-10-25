-- Who reads a worker's part of the work share, and so their statement: the
-- worker, and whoever distributes the surplus. A distribution's shares,
-- the reserves' and the work share's whole, stay everyone's. A write's
-- transaction sees every part.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('patronage', NULL, 'distribute-surplus', 'patronage');

ALTER TABLE patronage.part ENABLE ROW LEVEL SECURITY;

CREATE POLICY reads ON patronage.part FOR SELECT TO cella_app USING ((SELECT cella.sees('patronage')) OR worker = cella.reader() OR cella.reaches('patronage', worker));
CREATE POLICY rules ON patronage.part FOR SELECT TO cella_rules USING (true);
CREATE POLICY writes ON patronage.part FOR INSERT TO cella_app WITH CHECK (true);

ALTER VIEW patronage.statement SET (security_invoker = true);
