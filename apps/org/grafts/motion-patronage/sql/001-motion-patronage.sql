CREATE SCHEMA motion_patronage;

-- The motion of the members that approves a year's distribution. Both
-- sides are referenced by id, with no foreign key into either feat.
CREATE TABLE motion_patronage.approval (
  distribution text PRIMARY KEY,
  motion text NOT NULL
);

-- patronage:distribution:approve — the cited motion is the one that
-- approves this distribution. That it closed and passed on its roll is
-- circle-membership-motion's guard, attached through motion.cites.
CREATE FUNCTION motion_patronage.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN a.motion IS DISTINCT FROM d.id THEN d.id || ' does not approve ' || coalesce(p.distribution, 'a distribution')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'distribution' AS distribution) p
  LEFT JOIN motion.motion d ON d.id = p.motion
  LEFT JOIN motion_patronage.approval a ON a.distribution = p.distribution;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:distribution:approve', 'motion_patronage.approves(jsonb)', 'motion-patronage');
SELECT motion.register_cite('patronage:distribution:approve', 'approve-distribution', 'motion-patronage');

-- motion:motion:propose — each rule the motion would adopt that marks a
-- value of the patronage feat's is sound terms for the work share
-- (`patronage.terms_flaw`), applies from the first day of a fiscal year,
-- and replaces the rule of the latest terms, if any; and no policy it
-- would end is one terms copy, since terms are replaced, never ended.
CREATE FUNCTION motion_patronage.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN patronage.terms_flaw(motion.marked(m.args ->> 'wording')) IS NOT NULL
        THEN patronage.terms_flaw(motion.marked(m.args ->> 'wording'))
      WHEN coalesce(m.args ->> 'from', '') !~ '^[0-9]{4}-01-01$'
        THEN 'the work share''s terms apply from the first day of a fiscal year, as {"from": "2027-01-01"}'
      WHEN g.policy IS NOT NULL AND m.args ->> 'replaces' IS DISTINCT FROM g.policy
        THEN 'the work share''s terms replace the latest, ' || g.policy
    END AS r
    FROM motion.action m
    LEFT JOIN LATERAL (SELECT t.policy FROM patronage.terms t ORDER BY t."from" DESC, t.adopted DESC, t.id DESC LIMIT 1) g ON true
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'policy' AND m.args ->> 'kind' = 'rule'
      AND patronage.reads(motion.marked(m.args ->> 'wording'))
    UNION ALL
    SELECT t.policy || ' are the work share''s terms: later terms replace them, and none end them'
    FROM motion.action m
    JOIN patronage.terms t ON t.policy = m.args ->> 'policy'
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'end'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:propose', 'motion_patronage.asks(jsonb)', 'motion-patronage');

-- patronage:terms:adopt — the cited motion adopted the rule the terms
-- copy. That it closed and passed on its roll is circle-membership-motion's
-- guard, attached through motion.cites.
CREATE FUNCTION motion_patronage.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM policy.policy r JOIN motion.action m ON m.motion = r.motion AND m.n = r.n
      WHERE r.id = p.policy AND r.motion = d.id AND r.kind = 'rule' AND m.kind = 'policy'
    ) THEN d.id || ' adopted no rule ' || coalesce(p.policy, '')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'policy' AS policy) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:terms:adopt', 'motion_patronage.adopts(jsonb)', 'motion-patronage');
SELECT motion.register_cite('patronage:terms:adopt', 'adopt-policy', 'motion-patronage');

GRANT USAGE ON SCHEMA motion_patronage TO cella_app, cella_guards;
GRANT SELECT, INSERT ON motion_patronage.approval TO cella_app;
GRANT SELECT ON motion_patronage.approval TO cella_guards;
