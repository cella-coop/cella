CREATE SCHEMA worker;

-- Someone the co-op employs, member or not, by the address they sign
-- with: their job, the contract they hold, the days it runs from and to,
-- both included, and the time it asks of them a week, in minutes. A
-- permanent contract runs until the worker leaves; a fixed-term one, or
-- an apprenticeship, names its last day. `hired` is the day the hire was
-- recorded. Whether the worker is a member is the member-worker graft's;
-- their pay, payslip-worker's; their time, timesheet-worker's.
CREATE TABLE worker.worker (
  address text PRIMARY KEY,
  name text,
  job text NOT NULL CHECK (job <> ''),
  contract text NOT NULL CHECK (contract IN ('permanent', 'fixed-term', 'apprenticeship')),
  start date NOT NULL,
  until date,
  minutes integer NOT NULL CHECK (minutes > 0 AND minutes <= 48 * 60),
  hired date NOT NULL,
  CHECK (until IS NULL OR until >= start),
  CHECK (contract = 'permanent' OR until IS NOT NULL)
);

-- Whether a worker is employed on a day, and in any day of a month,
-- `YYYY-MM`.
CREATE FUNCTION worker.employed(address text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM worker.worker w
    WHERE w.address = employed.address AND w.start <= employed.day AND (w.until IS NULL OR w.until >= employed.day)
  );
END;

CREATE FUNCTION worker.employed_in(address text, month text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM worker.worker w
    WHERE w.address = employed_in.address
      AND w.start < (to_date(employed_in.month || '-01', 'YYYY-MM-DD') + interval '1 month')::date
      AND (w.until IS NULL OR w.until >= to_date(employed_in.month || '-01', 'YYYY-MM-DD'))
  );
END;

-- worker:worker:hire — the write recorded the worker's hire on the
-- verdict date, with the contract its payload names.
CREATE FUNCTION worker.hires(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.address IS NULL OR w.hired IS DISTINCT FROM cella.verdict_date()
      THEN coalesce(p.worker, 'no one') || ' was not hired by this write'
    WHEN (w.contract, w.start, w.until, w.minutes) IS DISTINCT FROM (p.contract, p.start, p.until, p.minutes)
      THEN w.address || '''s contract is not what the write names'
  END
  FROM (
    SELECT payload ->> 'worker' AS worker, payload ->> 'contract' AS contract, (payload ->> 'start')::date AS start,
           (payload ->> 'until')::date AS until, (payload ->> 'minutes')::integer AS minutes
  ) p
  LEFT JOIN worker.worker w ON w.address = p.worker;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('worker:worker:hire', 'worker.hires(jsonb)', 'worker');

GRANT USAGE ON SCHEMA worker TO cella_app, cella_rules;
GRANT SELECT ON worker.worker TO cella_app, cella_rules;
GRANT INSERT ON worker.worker TO cella_app;
