CREATE SCHEMA employment_membership;

-- A worker's candidacy for membership: the probation they serve as a
-- candidate, from and to, both included, and the shares they subscribe if
-- the assembly admits them; opened on a day, once. The worker is named by
-- address, with no foreign key into either feat.
CREATE TABLE employment_membership.candidacy (
  worker text PRIMARY KEY,
  "from" date NOT NULL,
  "to" date NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  opened date NOT NULL,
  CHECK ("to" >= "from")
);

-- Where each person who works here or belongs stands on the way to
-- membership, and each member on the way back: hired, a candidate on
-- probation, invited, a member, gone. A worker with no membership is an
-- employee or a candidate; a member with no employment was never employed
-- by the co-op.
CREATE VIEW employment_membership.path AS
SELECT x.address, x.name,
       w.start AS hired, w.until AS left, c."from" AS probation, c."to" AS probation_end, c.shares AS pledged,
       m.invited, m.since AS admitted, m.exited, m.status,
       CASE
         WHEN m.status = 'exited' THEN 'gone'
         WHEN m.status IN ('active', 'suspended') THEN 'member'
         WHEN m.status = 'invited' THEN 'invited'
         WHEN c.worker IS NOT NULL THEN 'candidate'
         ELSE 'employee'
       END AS stage
FROM person.person x
LEFT JOIN employment.worker w ON w.address = x.address
LEFT JOIN membership.member m ON m.address = x.address
LEFT JOIN employment_membership.candidacy c ON c.worker = x.address
WHERE w.address IS NOT NULL OR m.address IS NOT NULL;

-- employment-membership:candidacy:open — the write opened the worker's candidacy
-- on the verdict date, as its payload names it: a probation within their
-- employment, from no earlier than their hire, for someone who is no
-- member, or only invited.
CREATE FUNCTION employment_membership.opens(payload jsonb) RETURNS text
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
  LEFT JOIN employment.worker w ON w.address = p.worker
  LEFT JOIN membership.member m ON m.address = p.worker
  LEFT JOIN employment_membership.candidacy c ON c.worker = p.worker;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('employment-membership:candidacy:open', 'employment_membership.opens(jsonb)', 'employment-membership');

-- The power opening a candidacy needs, the manager's, as a hire's is.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('employment-membership:candidacy:open', 'hire-worker', NULL, 'employment-membership');

GRANT USAGE ON SCHEMA employment_membership TO cella_app, cella_guards;
GRANT SELECT ON employment_membership.candidacy, employment_membership.path TO cella_app, cella_guards;
GRANT INSERT ON employment_membership.candidacy TO cella_app;
