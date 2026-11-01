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

-- A share as a procedure policy writes it, its numerator and its
-- denominator: a fraction, `2/3`; a whole percent, `25 %`; or `none`.
CREATE FUNCTION motion.fraction(literal text) RETURNS integer[]
LANGUAGE sql IMMUTABLE
RETURN CASE
  WHEN literal ~* '^\s*none\s*$' THEN ARRAY[0, 1]
  WHEN literal ~ '^\s*[0-9]{1,4}\s*/\s*[0-9]{1,4}\s*$' THEN (regexp_match(literal, '([0-9]+)\s*/\s*([0-9]+)'))::integer[]
  WHEN translate(literal, E'   ', '') ~ '^[0-9]{1,3}%$' THEN ARRAY[rtrim(translate(literal, E'   ', ''), '%')::integer, 100]
END;

-- A procedure's terms from the values its policy marks, by name as
-- written (`{"procedure": "two-thirds", "method": "majority", "share":
-- "2/3", "quorum": "none"}`), and what is wrong with them, or null: it
-- names itself, decides by consent or majority, marks its quorum, a share
-- only for a majority, a ballot open or secret, and no other value. Its
-- label, unless it marks one, is its name in words.
CREATE FUNCTION motion.terms(marked jsonb) RETURNS TABLE (
  id text, label text, method text, share_num integer, share_den integer,
  quorum_num integer, quorum_den integer, ballot text, flaw text
)
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT v.id, upper(left(v.label, 1)) || substr(v.label, 2), v.method, f.s[1], f.s[2], f.q[1], f.q[2], coalesce(v.ballot, 'open'),
    CASE
      WHEN (SELECT k FROM jsonb_object_keys(coalesce(marked, '{}')) k
            WHERE k NOT IN ('procedure', 'label', 'method', 'share', 'quorum', 'ballot') ORDER BY k LIMIT 1) IS NOT NULL
        THEN 'a procedure marks its procedure, label, method, share, quorum and ballot, not '
          || (SELECT k FROM jsonb_object_keys(marked) k
              WHERE k NOT IN ('procedure', 'label', 'method', 'share', 'quorum', 'ballot') ORDER BY k LIMIT 1)
      WHEN v.id IS NULL THEN 'a procedure policy names its procedure, as {procedure: ordinary}'
      WHEN v.id !~ '^[a-z][a-z-]*$' THEN v.id || ' is no procedure''s name: lower-case letters and dashes'
      WHEN v.method IS NULL OR v.method NOT IN ('consent', 'majority')
        THEN 'a procedure decides by consent or majority, as {method: majority}, not ' || coalesce(v.method, 'nothing')
      WHEN v.quorum IS NULL THEN 'a procedure policy marks its quorum, as {quorum: 1/4}, or {quorum: none} where it needs none'
      WHEN f.q IS NULL OR f.q[2] = 0 OR f.q[1] > f.q[2]
        THEN 'a quorum is a share of the roll, as 1/4, 25 % or none, not ' || v.quorum
      WHEN v.share IS NOT NULL AND v.method <> 'majority' THEN 'a share is a majority''s: consent counts objections'
      WHEN v.share IS NOT NULL AND (f.s IS NULL OR f.s[2] = 0 OR f.s[1] = 0 OR f.s[1] > f.s[2])
        THEN 'a share is more than none of the votes cast and at most all, as 2/3 or 60 %, not ' || v.share
      WHEN v.ballot IS NOT NULL AND v.ballot NOT IN ('open', 'secret') THEN 'a ballot is open or secret, not ' || v.ballot
    END
  FROM (
    SELECT marked ->> 'procedure' AS id, coalesce(marked ->> 'label', replace(marked ->> 'procedure', '-', ' ')) AS label,
           marked ->> 'method' AS method, marked ->> 'share' AS share, marked ->> 'quorum' AS quorum, marked ->> 'ballot' AS ballot
  ) v,
  LATERAL (SELECT motion.fraction(v.share) AS s, motion.fraction(v.quorum) AS q) f;
END;

-- The values a legal wording marks, by name as written.
CREATE FUNCTION motion.marked(legal text) RETURNS jsonb
LANGUAGE sql IMMUTABLE
RETURN (SELECT jsonb_object_agg(m.name, m.literal) FROM policy.marks(legal) m);

-- The values a policy in the register marks, by name as written.
CREATE FUNCTION motion.marked_by(ref text) RETURNS jsonb
LANGUAGE sql STABLE
RETURN (SELECT jsonb_object_agg(v.name, v.literal) FROM policy.value v WHERE v.policy = ref);

-- What is wrong with the procedure a policy's values would make, or null:
-- its terms, or a name a procedure has already, unless it is a built-in
-- one no policy has made, whose terms the values repeat.
CREATE FUNCTION motion.procedure_flaw(marked jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(t.flaw, (
    SELECT o.id || ' is a procedure already, and its terms are fixed: a procedure on new terms takes a new name'
    FROM motion.procedure o
    WHERE o.id = t.id AND (o.policy IS NOT NULL
      OR (o.method, o.share_num, o.share_den, o.quorum_num, o.quorum_den, o.ballot)
         IS DISTINCT FROM (t.method, t.share_num, t.share_den, t.quorum_num, t.quorum_den, t.ballot))
  ))
  FROM motion.terms(marked) t;
END;

-- Copies a procedure policy's values into the procedure they make, in the
-- write that adopts it: a new procedure by the name it marks, or the
-- built-in one of that name, on the same terms, which now names it.
-- Returns the procedure's name, or null for a policy of another kind;
-- terms that make no procedure are refused (SQLSTATE 09000).
CREATE FUNCTION motion.procedure_from(ref text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  t record;
  wrong text;
BEGIN
  IF NOT EXISTS (SELECT FROM policy.policy p WHERE p.id = ref AND p.kind = 'procedure') THEN
    RETURN NULL;
  END IF;
  SELECT * INTO t FROM motion.terms(motion.marked_by(ref));
  wrong := motion.procedure_flaw(motion.marked_by(ref));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  UPDATE motion.procedure o SET policy = ref WHERE o.id = t.id AND o.policy IS NULL;
  IF NOT FOUND THEN
    INSERT INTO motion.procedure (id, label, method, share_num, share_den, quorum_num, quorum_den, ballot, policy)
    VALUES (t.id, t.label, t.method, t.share_num, t.share_den, t.quorum_num, t.quorum_den, t.ballot, ref);
  END IF;
  RETURN t.id;
END
$$;

GRANT INSERT, UPDATE (policy) ON motion.procedure TO cella_app;

-- motion:motion:propose — the procedure a motion is put to is built in,
-- or made by a policy in force on the verdict date: one ended, or applying
-- only later, puts no motion.
CREATE FUNCTION motion.decides_by(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT o.id || ' is no procedure in force: ' || r.id
    || CASE WHEN r.applies > cella.verdict_date() THEN ' applies from ' || to_char(r.applies, 'YYYY-MM-DD')
            ELSE ' ended on ' || to_char(r.ends, 'YYYY-MM-DD') END
  FROM motion.motion d
  JOIN motion.procedure o ON o.id = d.procedure
  JOIN policy.policy r ON r.id = o.policy
  WHERE d.id = payload ->> 'motion'
    AND (r.applies > cella.verdict_date() OR r.ends <= cella.verdict_date());
END;

-- motion:motion:propose — each policy the motion would adopt is of a
-- kind, worded soundly (`policy.flaw`), its days in order and none before
-- the motion's deadline, and replaces, if it names one, a policy of the
-- motion's circle and kind in force; a procedure policy marks terms that
-- make a procedure (`motion.procedure_flaw`).
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
      WHEN m.args ->> 'kind' = 'procedure' AND motion.procedure_flaw(motion.marked(m.args ->> 'wording')) IS NOT NULL
        THEN motion.procedure_flaw(motion.marked(m.args ->> 'wording'))
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
-- replaces ends that day; the entry commits to its hash; and a procedure
-- policy has made the procedure its values say.
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
    WHEN r.kind = 'procedure' AND NOT EXISTS (
      SELECT FROM motion.procedure o, motion.terms(motion.marked_by(r.id)) t
      WHERE o.policy = r.id AND o.id = t.id
        AND (o.method, o.share_num, o.share_den, o.quorum_num, o.quorum_den, o.ballot)
          IS NOT DISTINCT FROM (t.method, t.share_num, t.share_den, t.quorum_num, t.quorum_den, t.ballot)
    ) THEN r.id || ' makes no procedure on the terms it marks'
  END
  FROM (SELECT payload ->> 'motion' AS motion, (payload ->> 'n')::integer AS n, payload ->> 'policy' AS policy, payload ->> 'hash' AS hash) p
  LEFT JOIN motion.motion d ON d.id = p.motion
  LEFT JOIN motion.action m ON m.motion = d.id AND m.n = p.n
  LEFT JOIN policy.policy r ON r.motion = d.id AND r.n = p.n;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'motion.asks(jsonb)', 'motion'),
  ('motion:motion:propose', 'motion.decides_by(jsonb)', 'motion'),
  ('motion:policy:adopt', 'motion.adopts(jsonb)', 'motion');
