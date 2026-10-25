CREATE SCHEMA key_worker;

-- worker:worker:hire — the hire carries the worker's first device and
-- enrols it in its own transaction: the key its payload names, under the
-- worker's address, on the verdict date, enrolled by no device. A worker
-- signs their own writes from their first day, member or not; a hire with
-- no device is refused, so no one is hired unable to sign.
CREATE FUNCTION key_worker.carries(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.key IS NULL THEN coalesce(p.worker, 'no one') || ' is hired with no first device'
    WHEN NOT EXISTS (
      SELECT FROM key.device d
      WHERE encode(d.key, 'hex') = p.key AND d.address = p.worker AND d.enrolled = cella.verdict_date() AND d.enrolled_by IS NULL
    ) THEN p.worker || '''s first device was not enrolled by this hire'
  END
  FROM (SELECT payload ->> 'worker' AS worker, payload ->> 'key' AS key) p;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('worker:worker:hire', 'key_worker.carries(jsonb)', 'key-worker');

GRANT USAGE ON SCHEMA key_worker TO cella_app, cella_rules;
