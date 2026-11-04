-- Who reads a file, its name and its bytes: the co-op's own files, whoever
-- reads their circle (`circle.reads`), in place of core's row-level policy;
-- a personal file, the person it concerns, who uploaded it and whoever
-- holds a power that reads its class, which a graft registers. A write's
-- transaction sees every file. The parts are read through file.file
-- alone, so that its policy holds.
ALTER TABLE file.file ENABLE ROW LEVEL SECURITY;

DROP POLICY circle ON file.file;
CREATE POLICY reads ON file.file FOR SELECT TO cella_app
  USING ((class = 'none' AND circle = ANY ((SELECT circle.reads('{file}'))::text[])) OR (SELECT cella.sees('file')) OR cella.reader() IN (subject, uploader) OR cella.reaches('file', class));
CREATE POLICY guards ON file.file FOR SELECT TO cella_guards USING (true);
CREATE POLICY writes ON file.file FOR INSERT TO cella_app WITH CHECK (true);

REVOKE SELECT ON file.shared, file.receipt, file.contract, file.record FROM cella_app;
