-- Writes stay home: the adoption a motion asks for is its action,
-- which the motion feat writes, so this graft reads it rather than
-- copying it by a trigger on `motion.action`. That the action names
-- terms not yet adopted is `asks`, the guard on the proposal.
DROP TRIGGER adopts_terms ON motion.action;
DROP FUNCTION account_motion.moved();

ALTER TABLE account_motion.adoption RENAME TO recorded;

-- The motion of the members that adopts terms, as its action names
-- them: one row an action of the `terms` kind.
CREATE VIEW account_motion.adoption AS
SELECT m.args ->> 'terms' AS terms, m.motion
FROM motion.action m
WHERE m.kind = 'terms';

-- motion:motion:propose — each action to adopt terms names terms not
-- yet adopted.
CREATE OR REPLACE FUNCTION account_motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN t.id IS NULL THEN 'no terms ' || coalesce(m.args ->> 'terms', 'are named') || ' to adopt'
      WHEN t.adopted IS NOT NULL THEN t.id || ' were adopted on ' || to_char(t.adopted, 'YYYY-MM-DD')
    END AS r
    FROM motion.action m
    LEFT JOIN account.terms t ON t.id = m.args ->> 'terms'
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'terms'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- account:terms:adopt — the cited motion moved to adopt these terms.
CREATE OR REPLACE FUNCTION account_motion.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (SELECT FROM account_motion.adoption a WHERE a.terms = p.terms AND a.motion = d.id)
      THEN d.id || ' does not adopt ' || coalesce(p.terms, 'these terms')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'terms' AS terms) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

DROP TABLE account_motion.recorded;

GRANT SELECT ON account_motion.adoption TO cella_app, cella_guards;

-- What a passed motion carries into the books once it admits or ends a
-- membership, each citing it: the subscription, the withdrawal and the
-- freeze settle only once the motion closed and passed.
SELECT motion.register_cite('account:capital:subscribe', 'account-motion');
SELECT motion.register_cite('account:capital:withdraw', 'account-motion');
SELECT motion.register_cite('account:account:freeze', 'account-motion');
