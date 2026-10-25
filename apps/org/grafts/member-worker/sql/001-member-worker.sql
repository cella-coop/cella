CREATE SCHEMA member_worker;

-- A worker's candidacy for membership: the probation they serve as a
-- candidate, from and to, both included, and the shares they subscribe if
-- the assembly admits them; opened on a day, once. The worker is named by
-- address, with no foreign key into either feat.
CREATE TABLE member_worker.candidacy (
  worker text PRIMARY KEY,
  "from" date NOT NULL,
  "to" date NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  opened date NOT NULL,
  CHECK ("to" >= "from")
);

-- Where each worker stands on the way to membership, and each member on
-- the way back: hired, a candidate on probation, invited, a member, gone.
-- A worker with no member row is an employee or a candidate; a member
-- with no worker row was never employed by the co-op.
CREATE VIEW member_worker.path AS
SELECT coalesce(w.address, m.address) AS address,
       coalesce(m.name, w.name) AS name,
       w.start AS hired, w.until AS left, c."from" AS probation, c."to" AS probation_end, c.shares AS pledged,
       m.invited, m.since AS admitted, m.exited, m.status,
       CASE
         WHEN m.status = 'exited' THEN 'gone'
         WHEN m.status IN ('active', 'suspended') THEN 'member'
         WHEN m.status = 'invited' THEN 'invited'
         WHEN c.worker IS NOT NULL THEN 'candidate'
         ELSE 'employee'
       END AS stage
FROM worker.worker w
FULL JOIN member.member m ON m.address = w.address
LEFT JOIN member_worker.candidacy c ON c.worker = coalesce(w.address, m.address);

-- member-worker:candidacy:open — the write opened the worker's candidacy
-- on the verdict date, as its payload names it: a probation within their
-- employment, from no earlier than their hire, for someone who is no
-- member, or only invited.
CREATE FUNCTION member_worker.opens(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.address IS NULL THEN coalesce(p.worker, 'no one') || ' is no worker: a candidate is one'
    WHEN m.status IN ('active', 'suspended', 'exited') THEN w.address || ' is ' || m.status || ' as a member: a candidate is not yet one'
    WHEN c.worker IS NULL OR c.opened IS DISTINCT FROM cella.verdict_date()
      THEN w.address || '''s candidacy was not opened by this write'
    WHEN (c."from", c."to", c.shares) IS DISTINCT FROM (p."from", p."to", p.shares)
      THEN w.address || '''s candidacy is not what the write names'
    WHEN c."from" < w.start THEN w.address || '''s probation starts on ' || c."from"::text || ', before their hire on ' || w.start::text
    WHEN w.until IS NOT NULL AND c."to" > w.until
      THEN w.address || '''s probation ends on ' || c."to"::text || ', after their contract does on ' || w.until::text
  END
  FROM (
    SELECT payload ->> 'worker' AS worker, (payload ->> 'from')::date AS "from", (payload ->> 'to')::date AS "to",
           (payload ->> 'shares')::integer AS shares
  ) p
  LEFT JOIN worker.worker w ON w.address = p.worker
  LEFT JOIN member.member m ON m.address = p.worker
  LEFT JOIN member_worker.candidacy c ON c.worker = p.worker;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('member-worker:candidacy:open', 'member_worker.opens(jsonb)', 'member-worker');

-- The power opening a candidacy needs, the manager's, as a hire's is.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('member-worker:candidacy:open', 'hire-worker', NULL, 'member-worker');

GRANT USAGE ON SCHEMA member_worker TO cella_app, cella_rules;
GRANT SELECT ON member_worker.candidacy, member_worker.path TO cella_app, cella_rules;
GRANT INSERT ON member_worker.candidacy TO cella_app;
