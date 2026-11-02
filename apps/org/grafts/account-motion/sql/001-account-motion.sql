CREATE SCHEMA account_motion;

-- motion:motion:propose — each rule the motion would adopt that marks a
-- value of the account feat's is sound capital terms
-- (`account.terms_flaw`) and replaces the rule of the terms that govern,
-- if any; and no policy it would end is one terms copy, since terms are
-- replaced, never ended.
CREATE FUNCTION account_motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN account.terms_flaw(motion.marked(m.args ->> 'wording')) IS NOT NULL
        THEN account.terms_flaw(motion.marked(m.args ->> 'wording'))
      WHEN g.policy IS NOT NULL AND m.args ->> 'replaces' IS DISTINCT FROM g.policy
        THEN 'the capital''s terms replace those that govern, ' || g.policy
    END AS r
    FROM motion.action m
    LEFT JOIN account.terms g ON g.id = account.capital_for(cella.verdict_date())
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'policy' AND m.args ->> 'kind' = 'rule'
      AND account.reads(motion.marked(m.args ->> 'wording'))
    UNION ALL
    SELECT t.policy || ' are the capital''s terms: later terms replace them, and none end them'
    FROM motion.action m
    JOIN account.terms t ON t.policy = m.args ->> 'policy'
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'end'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:propose', 'account_motion.asks(jsonb)', 'account-motion');

-- account:terms:adopt — the cited motion adopted the rule the terms copy.
-- That it closed and passed on its roll is circle-membership-motion's guard,
-- attached through motion.cites.
CREATE FUNCTION account_motion.adopts(payload jsonb) RETURNS text
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

INSERT INTO cella.guard (op, fn, owner) VALUES ('account:terms:adopt', 'account_motion.adopts(jsonb)', 'account-motion');
SELECT motion.register_cite('account:terms:adopt', 'account-motion');

GRANT USAGE ON SCHEMA account_motion TO cella_app, cella_guards;
