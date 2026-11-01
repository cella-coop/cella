-- Writes stay home: what a motion asks to adopt or approve is its
-- action, which the motion feat writes, so this graft reads it rather
-- than copying it by a trigger on `motion.action`. That the action names
-- drafted terms or a drafted distribution is the guards on the proposal.
DROP TRIGGER adopts_patronage_terms ON motion.action;
DROP TRIGGER approves_patronage_distribution ON motion.action;
DROP FUNCTION motion_patronage.moved();
DROP FUNCTION motion_patronage.moved_to_approve();

ALTER TABLE motion_patronage.adoption RENAME TO recorded_adoption;
ALTER TABLE motion_patronage.approval RENAME TO recorded_approval;

-- The motion of the members that adopts terms, as its action names
-- them: one row an action of the `patronage` kind.
CREATE VIEW motion_patronage.adoption AS
SELECT m.args ->> 'terms' AS terms, m.motion
FROM motion.action m
WHERE m.kind = 'patronage';

-- The motions moving to approve a distribution: one row an action of the
-- `distribution` kind. A draft moved again, after a motion that failed,
-- has a row for each; approving it cites one that passed.
CREATE VIEW motion_patronage.approval AS
SELECT m.args ->> 'distribution' AS distribution, m.motion
FROM motion.action m
WHERE m.kind = 'distribution';

-- patronage:distribution:approve — the cited motion moved to approve
-- this distribution. That it closed and passed on its roll is
-- circle-membership-motion's guard, attached through motion.cites.
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

-- motion:motion:propose — each action to adopt terms names terms not
-- yet adopted.
CREATE OR REPLACE FUNCTION motion_patronage.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN t.id IS NULL THEN 'no terms ' || coalesce(m.args ->> 'terms', 'are named') || ' to adopt'
      WHEN t.adopted IS NOT NULL THEN t.id || ' were adopted on ' || to_char(t.adopted, 'YYYY-MM-DD')
    END AS r
    FROM motion.action m
    LEFT JOIN patronage.terms t ON t.id = m.args ->> 'terms'
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'patronage'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- patronage:terms:adopt — the cited motion moved to adopt these terms.
CREATE OR REPLACE FUNCTION motion_patronage.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (SELECT FROM motion_patronage.adoption a WHERE a.terms = p.terms AND a.motion = d.id)
      THEN d.id || ' does not adopt ' || coalesce(p.terms, 'these terms')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'terms' AS terms) p
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

DROP TABLE motion_patronage.recorded_adoption;
DROP TABLE motion_patronage.recorded_approval;

GRANT SELECT ON motion_patronage.adoption, motion_patronage.approval TO cella_app, cella_guards;
