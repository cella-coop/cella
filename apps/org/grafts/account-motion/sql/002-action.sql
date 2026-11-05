-- What a passed motion carries into the books once it admits or excludes
-- a member, each citing it: the subscription, the withdrawal and the
-- freeze settle only once the motion closed and passed.
SELECT motion.register_cite('account:capital:subscribe', 'admit-member', 'account-motion');
SELECT motion.register_cite('account:capital:withdraw', 'exclude-member', 'account-motion');
SELECT motion.register_cite('account:account:freeze', 'exclude-member', 'account-motion');

-- account:capital:subscribe — the cited motion carries an action
-- admitting the member who subscribes, as the motion feat records it.
CREATE FUNCTION account_motion.admits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM motion.action m WHERE m.motion = d.id AND m.kind = 'admit' AND m.args ->> 'member' = p.member
    ) THEN d.id || ' does not admit ' || coalesce(p.member, 'anyone')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'member' AS member) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

-- account:capital:withdraw, account:account:freeze — the cited motion
-- carries an action excluding the member whose capital is withdrawn, or
-- the holder whose accounts are frozen.
CREATE FUNCTION account_motion.excludes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM motion.action m WHERE m.motion = d.id AND m.kind = 'exclude' AND m.args ->> 'member' = p.member
    ) THEN d.id || ' does not exclude ' || coalesce(p.member, 'anyone')
  END
  FROM (SELECT payload ->> 'motion' AS motion, coalesce(payload ->> 'member', payload ->> 'holder') AS member) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('account:capital:subscribe', 'account_motion.admits(jsonb)', 'account-motion'),
  ('account:capital:withdraw', 'account_motion.excludes(jsonb)', 'account-motion'),
  ('account:account:freeze', 'account_motion.excludes(jsonb)', 'account-motion');
