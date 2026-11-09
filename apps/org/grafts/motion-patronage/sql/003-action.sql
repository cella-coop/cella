-- Writes stay home: what a motion asks to approve is its
-- action, which the motion feat writes, so this graft reads it rather
-- than copying it by a trigger on `motion.action`. That the action names
-- a drafted distribution is the guard on the proposal.
DROP TRIGGER approves_patronage_distribution ON motion.action;
DROP FUNCTION motion_patronage.moved_to_approve();

ALTER TABLE motion_patronage.approval RENAME TO recorded_approval;

-- The motions moving to approve a distribution: one row an action of the
-- `distribution` kind. A draft moved again, after a motion that failed,
-- has a row for each; approving it cites one that passed.
CREATE VIEW motion_patronage.approval WITH (security_invoker = true) AS
SELECT m.args ->> 'distribution' AS distribution, m.motion
FROM motion.action m
WHERE m.kind = 'distribution';

-- patronage:distribution:approve — the cited motion moved to approve
-- this distribution. That it closed and passed on its roll is
-- the motion feat's guard, motion.carried, attached through motion.cites.
CREATE OR REPLACE FUNCTION motion_patronage.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (SELECT FROM motion_patronage.approval a WHERE a.distribution = p.distribution AND a.motion = d.id)
      THEN d.id || ' does not approve ' || coalesce(p.distribution, 'a distribution')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'distribution' AS distribution) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- motion:motion:propose — each action to approve a distribution names
-- a draft not yet approved.
CREATE OR REPLACE FUNCTION motion_patronage.asks_to_approve(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN l.id IS NULL THEN 'no distribution ' || coalesce(m.args ->> 'distribution', 'is named') || ' to approve'
      WHEN l.approved IS NOT NULL THEN l.id || ' was approved on ' || to_char(l.approved, 'YYYY-MM-DD')
    END AS r
    FROM motion.action m
    LEFT JOIN patronage.distribution l ON l.id = m.args ->> 'distribution'
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'distribution'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

DROP TABLE motion_patronage.recorded_approval;

GRANT SELECT ON motion_patronage.approval TO cella_app, cella_guards;

-- What follows an approval cites its motion: the distribution that posts
-- the split, and each credit of the shares an associate's part buys.
-- Each settles only once that motion moved to approve this distribution
-- and, through motion.cites, closed and passed.
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('patronage:distribution:distribute', 'motion_patronage.approves(jsonb)', 'motion-patronage'),
  ('patronage:part:employ', 'motion_patronage.approves(jsonb)', 'motion-patronage');
SELECT motion.register_cite('patronage:distribution:distribute', 'approve-distribution', 'motion-patronage');
SELECT motion.register_cite('patronage:part:employ', 'approve-distribution', 'motion-patronage');
