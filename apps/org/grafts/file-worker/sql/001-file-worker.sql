CREATE SCHEMA file_worker;

-- A worker's employment records on file, such as their signed contract
-- or its amendments: each a file of class payroll about them, kept once.
-- Both by id, with no foreign key into either feat.
CREATE TABLE file_worker.record (
  worker text NOT NULL,
  file text NOT NULL UNIQUE,
  PRIMARY KEY (worker, file)
);

-- file-worker:worker:attach — whoever hires files a worker's employment
-- record, a file they uploaded by this write about that worker; the
-- circle-member graft checks the power.
CREATE FUNCTION file_worker.files(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.address IS NULL THEN 'no worker ' || coalesce(x.worker, 'is named')
    WHEN r.file IS NULL THEN coalesce(x.file, 'no file') || ' is not on ' || w.address || '''s file'
    ELSE file.stored(x.file, 'payroll', w.address)
  END
  FROM (SELECT payload ->> 'worker' AS worker, payload ->> 'file' AS file) x
  LEFT JOIN worker.worker w ON w.address = x.worker
  LEFT JOIN file_worker.record r ON r.worker = x.worker AND r.file = x.file;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('file-worker:worker:attach', 'file_worker.files(jsonb)', 'file-worker');

-- Who keeps the employment records: whoever hires.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('file-worker:worker:attach', 'hire-worker', NULL, 'file-worker');

GRANT USAGE ON SCHEMA file_worker TO cella_app, cella_rules;
GRANT SELECT ON file_worker.record TO cella_app, cella_rules;
GRANT INSERT ON file_worker.record TO cella_app;
