CREATE SCHEMA employment_membership;

-- A worker's candidacy for membership: the probation they serve as a
-- candidate, from and to, both included, and the shares they subscribe if
-- the assembly admits them; opened on a day, once. One opened on an
-- application runs from the hire to the day before it. The worker is
-- named by address, with no foreign key into either feat.
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
-- by the co-op. One who applied is invited, from the day they applied.
CREATE VIEW employment_membership.path AS
SELECT x.address, x.name,
       w.start AS hired, w.until AS left, c."from" AS probation, c."to" AS probation_end, c.shares AS pledged,
       m.invited, m.applied, m.since AS admitted, m.exited, m.status,
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

-- membership:member:apply — the applicant has worked a year: hired a year
-- or more before the verdict date, and employed on it. The year is this
-- guard's; the policy granting the right marks no value for it.
CREATE FUNCTION employment_membership.serves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN w.address IS NULL THEN coalesce(p.member, 'no one') || ' is no worker: an employee applies to join'
    WHEN w.until IS NOT NULL AND w.until < cella.verdict_date()
      THEN w.address || '''s contract ended on ' || w.until::text || ': an employee applies to join'
    WHEN w.start > cella.verdict_date() - interval '1 year'
      THEN w.address || ' was hired on ' || w.start::text || ': an employee applies to join after a year''s employment, from '
        || (w.start + interval '1 year')::date::text
  END
  FROM (SELECT payload ->> 'member' AS member) p
  LEFT JOIN employment.worker w ON w.address = p.member;
END;

-- employment-membership:candidacy:open — the worker opened their own
-- candidacy on the day they applied, as the payload names it: from their
-- hire to the day before, pledging shares.
CREATE FUNCTION employment_membership.opens(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.worker IS DISTINCT FROM cella.actor()
      THEN cella.actor() || ' may not open ' || coalesce(p.worker, 'no one') || '''s candidacy: only their own, on their application'
    WHEN w.address IS NULL THEN coalesce(p.worker, 'no one') || ' is no worker: a candidate is one'
    WHEN m.status IN ('active', 'suspended', 'exited') THEN w.address || ' is ' || m.status || ' as a member: a candidate is not yet one'
    WHEN m.applied IS DISTINCT FROM cella.verdict_date()
      THEN w.address || ' has not applied to join today: a candidacy opens on an application'
    WHEN c.worker IS NULL OR c.opened IS DISTINCT FROM cella.verdict_date()
      THEN w.address || '''s candidacy was not opened by this write'
    WHEN (c."from", c."to", c.shares) IS DISTINCT FROM (p."from", p."to", p.shares)
      THEN w.address || '''s candidacy is not what the write names'
    WHEN (c."from", c."to") IS DISTINCT FROM (w.start, cella.verdict_date() - 1)
      THEN w.address || '''s candidacy runs from their hire on ' || w.start::text || ' to the day before they applied'
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
  ('membership:member:apply', 'employment_membership.serves(jsonb)', 'employment-membership'),
  ('employment-membership:candidacy:open', 'employment_membership.opens(jsonb)', 'employment-membership');

-- The power opening a candidacy needs, the right to apply, every
-- employee's: `opens` holds it to one's own, on one's application.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('employment-membership:candidacy:open', 'apply-membership', NULL, 'employment-membership');

GRANT USAGE ON SCHEMA employment_membership TO cella_app, cella_guards;
GRANT SELECT ON employment_membership.candidacy, employment_membership.path TO cella_app, cella_guards;
GRANT INSERT ON employment_membership.candidacy TO cella_app;
