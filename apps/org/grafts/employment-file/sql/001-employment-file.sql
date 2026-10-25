CREATE SCHEMA employment_file;

-- A worker's employment records on file, such as their signed contract
-- or its amendments: each a file of class payroll about them, kept once.
-- Both by id, with no foreign key into either feat.
CREATE TABLE employment_file.record (
  worker text NOT NULL,
  file text NOT NULL UNIQUE,
  PRIMARY KEY (worker, file)
);

-- employment-file:worker:attach — whoever hires files a worker's employment
-- record, a file they uploaded by this write about that worker; the
-- circle-membership graft checks the power.
CREATE FUNCTION employment_file.files(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.address IS NULL THEN 'no worker ' || coalesce(x.worker, 'is named')
    WHEN r.file IS NULL THEN coalesce(x.file, 'no file') || ' is not on ' || w.address || '''s file'
    ELSE file.stored(x.file, 'payroll', w.address)
  END
  FROM (SELECT payload ->> 'worker' AS worker, payload ->> 'file' AS file) x
  LEFT JOIN employment.worker w ON w.address = x.worker
  LEFT JOIN employment_file.record r ON r.worker = x.worker AND r.file = x.file;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('employment-file:worker:attach', 'employment_file.files(jsonb)', 'employment-file');

-- Who keeps the employment records: whoever hires.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('employment-file:worker:attach', 'hire-worker', NULL, 'employment-file');

GRANT USAGE ON SCHEMA employment_file TO cella_app, cella_rules;
GRANT SELECT ON employment_file.record TO cella_app, cella_rules;
GRANT INSERT ON employment_file.record TO cella_app;
