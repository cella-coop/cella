-- Adopting a policy: a kind of action a motion carries, which this feat
-- carries out itself, since a policy is a sentence its circle adopts by
-- motion and the register, `policy`, is org's core's. Its arguments: the
-- policy's kind, its legal wording with each value marked once as
-- `{name: value}`, perhaps a friendly wording, perhaps the day it applies
-- from and the day it ends, perhaps the policy of its circle it replaces.
SELECT motion.register_carries('policy', 'Adopt a policy', '[{"name": "kind", "label": "Kind", "type": "text", "options": "policyKinds"}, {"name": "wording", "label": "Wording, each value marked {name: value}", "type": "text"}, {"name": "friendly", "label": "In plain words", "type": "text", "optional": true}, {"name": "from", "label": "Applies from (YYYY-MM-DD)", "type": "text", "optional": true}, {"name": "until", "label": "Until (YYYY-MM-DD)", "type": "text", "optional": true}, {"name": "replaces", "label": "Replaces", "type": "text", "optional": true, "options": "policies"}]', 'motion');

-- An adoption cites the motion that carries it: the graft that counts the
-- roll attaches its guard that the motion closed and passed.
SELECT motion.register_cite('motion:policy:adopt', 'motion');

-- motion:motion:propose — each policy the motion would adopt is of a
-- kind, worded soundly (`policy.flaw`), its days in order and none before
-- the motion's deadline, and replaces, if it names one, a policy of the
-- motion's circle and kind in force.
CREATE FUNCTION motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN coalesce(m.args ->> 'kind', '') NOT IN ('mandate', 'rule', 'procedure')
        THEN 'a policy is a mandate, a rule or a procedure, not ' || coalesce(m.args ->> 'kind', 'nothing')
      WHEN policy.flaw(m.args ->> 'wording', m.args ->> 'friendly') IS NOT NULL
        THEN policy.flaw(m.args ->> 'wording', m.args ->> 'friendly')
      WHEN coalesce(m.args ->> 'from', '') !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
        OR coalesce(m.args ->> 'until', '') !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
        THEN 'a policy''s days are written YYYY-MM-DD'
      WHEN (m.args ->> 'from')::date < d.deadline
        THEN 'a policy applies at the earliest from ' || to_char(d.deadline, 'YYYY-MM-DD') || ', when ' || d.id || ' may close'
      WHEN (m.args ->> 'until')::date < coalesce((m.args ->> 'from')::date, d.deadline)
        THEN 'a policy ends after it applies'
      WHEN m.args ? 'replaces' AND NOT EXISTS (
        SELECT FROM policy.in_force(d.circle, cella.verdict_date()) f
        WHERE f.id = m.args ->> 'replaces' AND f.kind = m.args ->> 'kind'
      ) THEN 'no ' || (m.args ->> 'kind') || ' of ' || d.circle || ' in force is ' || (m.args ->> 'replaces')
    END AS r
    FROM motion.action m
    JOIN motion.motion d ON d.id = m.motion
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'policy'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- motion:policy:adopt — the register's policy is the one the cited
-- motion's action carries: of its circle, of that kind, worded as the
-- motion names it (by the hash of its wordings, never by reading them
-- back), applying from the day the action names, or the verdict date,
-- whichever is later, and until the day it names; a policy it
-- replaces ends that day; and the entry commits to its hash.
CREATE FUNCTION motion.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN m.kind IS DISTINCT FROM 'policy' THEN d.id || ' adopts no policy as its action ' || coalesce(p.n::text, '?')
    WHEN r.id IS NULL OR r.id IS DISTINCT FROM p.policy THEN d.id || ' adopted no policy ' || coalesce(p.policy, '') || ' by this write'
    WHEN r.circle <> d.circle OR r.kind <> m.args ->> 'kind' OR r.motion <> d.id OR r.n <> m.n
      OR r.hash <> policy.hash(m.args ->> 'wording', nullif(btrim(m.args ->> 'friendly'), ''))
      THEN r.id || ' is not the policy ' || d.id || ' adopts'
    WHEN encode(r.hash, 'hex') IS DISTINCT FROM p.hash THEN 'the entry does not commit to ' || r.id || '''s hash'
    WHEN r.adopted <> cella.verdict_date()
      OR r.applies <> greatest(coalesce((m.args ->> 'from')::date, cella.verdict_date()), cella.verdict_date())
      OR r.ends IS DISTINCT FROM (m.args ->> 'until')::date
      OR r.replaces IS DISTINCT FROM m.args ->> 'replaces'
      THEN r.id || ' does not apply on the days ' || d.id || ' names'
    WHEN r.replaces IS NOT NULL AND NOT EXISTS (
      SELECT FROM policy.policy o WHERE o.id = r.replaces AND o.ends = r.applies
    ) THEN r.replaces || ' does not end the day ' || r.id || ' applies'
  END
  FROM (SELECT payload ->> 'motion' AS motion, (payload ->> 'n')::integer AS n, payload ->> 'policy' AS policy, payload ->> 'hash' AS hash) p
  LEFT JOIN motion.motion d ON d.id = p.motion
  LEFT JOIN motion.action m ON m.motion = d.id AND m.n = p.n
  LEFT JOIN policy.policy r ON r.motion = d.id AND r.n = p.n;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'motion.asks(jsonb)', 'motion'),
  ('motion:policy:adopt', 'motion.adopts(jsonb)', 'motion');
