-- Adopting a policy: a kind of action a motion carries, which this feat
-- carries out itself, since a policy is a sentence its circle adopts by
-- motion and the register, `policy`, is org's core's. Its arguments: the
-- policy's kind, its legal wording with each value marked once as
-- `{name: value}`, perhaps a friendly wording, perhaps the day it applies
-- from and the day it ends, perhaps the policy of its circle it replaces,
-- perhaps the procedure by which alone it is replaced or ended, perhaps
-- the default policy of a legal form it takes.
SELECT motion.register_carries('policy', 'Adopt a policy', '[{"name": "kind", "label": "Kind", "type": "text", "options": "policyKinds"}, {"name": "wording", "label": "Wording, each value marked {name: value}", "type": "text"}, {"name": "friendly", "label": "In plain words", "type": "text", "optional": true}, {"name": "from", "label": "Applies from (YYYY-MM-DD)", "type": "text", "optional": true}, {"name": "until", "label": "Until (YYYY-MM-DD)", "type": "text", "optional": true}, {"name": "replaces", "label": "Replaces", "type": "text", "optional": true, "options": "policies"}, {"name": "protected", "label": "Changed only by", "type": "text", "optional": true, "options": "protections"}, {"name": "takes", "label": "Takes the default", "type": "text", "optional": true, "options": "defaults"}]', 'motion:policy:adopt', 'motion');

-- Ending a policy, which binds no longer from the verdict date: its
-- argument, the policy of the motion's circle it ends.
SELECT motion.register_carries('end', 'End a policy', '[{"name": "policy", "label": "Policy", "type": "text", "options": "policies"}]', 'motion:policy:end', 'motion');

-- An adoption and an end cite the motion that carries them, with the
-- powers a collective mandate of its circle grants them: the graft that
-- counts the roll attaches its guard that the motion closed and passed.
SELECT motion.register_cite('motion:policy:adopt', 'adopt-policy', 'motion');
SELECT motion.register_cite('motion:policy:end', 'end-policy', 'motion');

-- A share as a procedure policy writes it, its numerator and its
-- denominator: a fraction, `2/3`; a whole percent, `25 %`; or `none`.
CREATE FUNCTION motion.fraction(literal text) RETURNS integer[]
LANGUAGE sql IMMUTABLE
RETURN CASE
  WHEN literal ~* '^\s*none\s*$' THEN ARRAY[0, 1]
  WHEN literal ~ '^\s*[0-9]{1,4}\s*/\s*[0-9]{1,4}\s*$' THEN (regexp_match(literal, '([0-9]+)\s*/\s*([0-9]+)'))::integer[]
  WHEN translate(literal, E'   ', '') ~ '^[0-9]{1,3}%$' THEN ARRAY[rtrim(translate(literal, E'   ', ''), '%')::integer, 100]
END;

-- A list of roles as a procedure policy writes it, by id, separated by
-- commas or `and` (`lead, secretary`), in order; none where none is
-- written.
CREATE FUNCTION motion.roles(literal text) RETURNS text[]
LANGUAGE sql IMMUTABLE
RETURN CASE WHEN literal IS NOT NULL THEN
  ARRAY(SELECT DISTINCT btrim(r) FROM regexp_split_to_table(literal, '\s*,\s*|\s+and\s+') r WHERE btrim(r) <> '' ORDER BY 1)
END;

-- A procedure's terms from the values its policy marks, by name as
-- written (`{"procedure": "two-thirds", "method": "majority", "share":
-- "2/3", "quorum": "none"}`), and what is wrong with them, or null: it
-- names itself, decides by consent or majority, marks its quorum, a share
-- only for a majority, a ballot open or secret, perhaps the roles that
-- vote and those that may veto, each a role's id, perhaps the circle it
-- consults, by id, and no other value. Its label, unless it marks one, is
-- its name in words.
CREATE FUNCTION motion.terms(marked jsonb) RETURNS TABLE (
  id text, label text, method text, share_num integer, share_den integer,
  quorum_num integer, quorum_den integer, ballot text, voters text[], veto text[], consult text, flaw text
)
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT v.id, upper(left(v.label, 1)) || substr(v.label, 2), v.method, f.s[1], f.s[2], f.q[1], f.q[2], coalesce(v.ballot, 'open'), f.voters, coalesce(f.veto, '{}'), v.consult,
    CASE
      WHEN (SELECT k FROM jsonb_object_keys(coalesce(marked, '{}')) k
            WHERE k NOT IN ('procedure', 'label', 'method', 'share', 'quorum', 'ballot', 'voters', 'veto', 'consult') ORDER BY k LIMIT 1) IS NOT NULL
        THEN 'a procedure marks its procedure, label, method, share, quorum, ballot, voters, veto and consult, not '
          || (SELECT k FROM jsonb_object_keys(marked) k
              WHERE k NOT IN ('procedure', 'label', 'method', 'share', 'quorum', 'ballot', 'voters', 'veto', 'consult') ORDER BY k LIMIT 1)
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
      WHEN v.voters IS NOT NULL AND (cardinality(f.voters) = 0 OR EXISTS (SELECT FROM unnest(f.voters) x WHERE x !~ '^[a-z][a-z0-9-]*$'))
        THEN 'a procedure names the roles that vote by id, as {voters: lead, secretary}, not ' || v.voters
      WHEN v.veto IS NOT NULL AND (cardinality(f.veto) = 0 OR EXISTS (SELECT FROM unnest(f.veto) x WHERE x !~ '^[a-z][a-z0-9-]*$'))
        THEN 'a procedure names the roles that may veto by id, as {veto: lead}, not ' || v.veto
      WHEN v.consult IS NOT NULL AND btrim(v.consult) !~ '^[a-z][a-z0-9-]*$'
        THEN 'a procedure names the circle it consults by id, as {consult: coordination}, not ' || v.consult
    END
  FROM (
    SELECT marked ->> 'procedure' AS id, coalesce(marked ->> 'label', replace(marked ->> 'procedure', '-', ' ')) AS label,
           marked ->> 'method' AS method, marked ->> 'share' AS share, marked ->> 'quorum' AS quorum, marked ->> 'ballot' AS ballot,
           marked ->> 'voters' AS voters, marked ->> 'veto' AS veto, btrim(marked ->> 'consult') AS consult
  ) v,
  LATERAL (SELECT motion.fraction(v.share) AS s, motion.fraction(v.quorum) AS q, motion.roles(v.voters) AS voters, motion.roles(v.veto) AS veto) f;
END;

-- The parties a procedure's values name, each grantee by its kind: the
-- roles that vote, `votes`, those that may veto, `vetoes`, and the circle
-- it consults, `consulted`.
CREATE FUNCTION motion.named(voters text[], veto text[], consult text) RETURNS TABLE (kind text, grantee text)
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT 'votes', v FROM unnest(named.voters) v
  UNION SELECT 'vetoes', v FROM unnest(named.veto) v
  UNION SELECT 'consulted', named.consult WHERE named.consult IS NOT NULL;
END;

-- A procedure's parties, each as its kind and its grantee (`vetoes
-- lead`), in order, so the parties of two procedures, or of a procedure
-- and the values a policy marks, compare.
CREATE FUNCTION motion.parties(ref text) RETURNS text[]
LANGUAGE sql STABLE
RETURN ARRAY(SELECT q.kind || ' ' || q.grantee FROM motion.party q WHERE q.procedure = parties.ref ORDER BY 1);

-- The circle a procedure consults, or null.
CREATE FUNCTION motion.consults(ref text) RETURNS text
LANGUAGE sql STABLE
RETURN (SELECT q.grantee FROM motion.party q WHERE q.procedure = consults.ref AND q.kind = 'consulted');

-- The roles whose seats a procedure calls to its roll, those that vote
-- and those that may veto, in order; null for every seat, where no
-- party votes or `participant` does.
CREATE FUNCTION motion.calls(ref text) RETURNS text[]
LANGUAGE sql STABLE
RETURN CASE WHEN EXISTS (SELECT FROM motion.party q WHERE q.procedure = calls.ref AND q.kind = 'votes')
    AND NOT EXISTS (SELECT FROM motion.party q WHERE q.procedure = calls.ref AND q.kind = 'votes' AND q.grantee = 'participant')
  THEN ARRAY(SELECT DISTINCT q.grantee FROM motion.party q WHERE q.procedure = calls.ref AND q.kind IN ('votes', 'vetoes') ORDER BY 1)
END;

-- Whether a seat in `role` votes by a procedure: where no party votes,
-- every seat does; else a seat in a role that does, `participant` every
-- seat. A seat with no role, a member's own, votes only by the first.
CREATE FUNCTION motion.votes(ref text, role text) RETURNS boolean
LANGUAGE sql STABLE
RETURN NOT EXISTS (SELECT FROM motion.party q WHERE q.procedure = votes.ref AND q.kind = 'votes')
  OR EXISTS (SELECT FROM motion.party q WHERE q.procedure = votes.ref AND q.kind = 'votes' AND q.grantee IN ('participant', votes.role));

-- What is wrong with the parties a procedure's values name, or null: each
-- is a grantee there is, and of its kind, a role to vote or veto and a
-- circle to be consulted; the reason names the first that is not.
CREATE FUNCTION motion.party_flaw(voters text[], veto text[], consult text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN x.wants = 'circle' AND g.id IS NULL THEN 'no circle ' || x.grantee || ' for a procedure to consult'
    WHEN x.wants = 'circle' THEN x.grantee || ' is a role, and a procedure consults a circle'
    WHEN g.id IS NULL THEN 'no role ' || x.grantee || ' for a procedure''s ' || x.term
    ELSE x.grantee || ' is a circle, and a procedure''s ' || x.term || ' are roles'
  END
  FROM (
    SELECT v AS grantee, 'role' AS wants, 'voters' AS term, 1 AS o FROM unnest(party_flaw.voters) v
    UNION ALL SELECT v, 'role', 'vetoes', 2 FROM unnest(party_flaw.veto) v
    UNION ALL SELECT party_flaw.consult, 'circle', 'consultation', 3 WHERE party_flaw.consult IS NOT NULL
  ) x
  LEFT JOIN circle.grantee g ON g.id = x.grantee
  WHERE g.kind IS DISTINCT FROM x.wants
  ORDER BY x.o, x.grantee
  LIMIT 1;
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
-- its terms; its parties (`motion.party_flaw`); or a name a procedure has
-- already, unless it is a built-in one no policy has made, whose terms
-- and parties the values repeat.
CREATE FUNCTION motion.procedure_flaw(marked jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(t.flaw, motion.party_flaw(t.voters, t.veto, t.consult), (
    SELECT o.id || ' is a procedure already, and its terms are fixed: a procedure on new terms takes a new name'
    FROM motion.procedure o
    WHERE o.id = t.id AND (o.policy IS NOT NULL
      OR (o.method, o.share_num, o.share_den, o.quorum_num, o.quorum_den, o.ballot)
         IS DISTINCT FROM (t.method, t.share_num, t.share_den, t.quorum_num, t.quorum_den, t.ballot)
      OR motion.parties(o.id) IS DISTINCT FROM ARRAY(SELECT n.kind || ' ' || n.grantee FROM motion.named(t.voters, t.veto, t.consult) n ORDER BY 1))
  ))
  FROM motion.terms(marked) t;
END;

-- Copies a procedure policy's values into the procedure they make, in the
-- write that adopts it: a new procedure by the name it marks, with the
-- parties it names, or the built-in one of that name, on the same terms,
-- which now names it. Returns the procedure's name, or null for a policy
-- of another kind; terms that make no procedure, or parties that name no
-- grantee of their kind, are refused (SQLSTATE 09000), the reason naming
-- which.
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
    INSERT INTO motion.party (procedure, kind, grantee)
    SELECT t.id, n.kind, n.grantee FROM motion.named(t.voters, t.veto, t.consult) n;
  END IF;
  RETURN t.id;
END
$$;

GRANT INSERT, UPDATE (policy) ON motion.procedure TO cella_app;
GRANT INSERT ON motion.party TO cella_app;

-- Whether procedure `a` is at least as strict as procedure `b`: every
-- count that passes by `a` passes by `b` too. So both decide by the same
-- method and call the same roll, every seat or the seats of the same
-- parties, those that vote and those that may veto (`motion.calls`);
-- `a`'s quorum is no lower; and, for a majority, `a` lets every party
-- veto that `b` does, and its share of the votes cast is no lower, more
-- for than against being stricter than any half or less and looser than
-- any more than half. Consent and a majority count different stances, so
-- neither is stricter than the other; under consent any objection
-- blocks, so a veto adds nothing. `a` consults the party `b` consults, if
-- any. The ballot changes no count. A procedure is as strict as
-- itself, and a name no procedure has is as strict as none.
CREATE FUNCTION motion.as_strict(a text, b text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce((
    SELECT x.id = y.id OR (
      x.method = y.method
      AND motion.calls(x.id) IS NOT DISTINCT FROM motion.calls(y.id)
      AND x.quorum_num::bigint * y.quorum_den >= y.quorum_num::bigint * x.quorum_den
      AND (x.method = 'consent' OR (NOT EXISTS (
        SELECT FROM motion.party v
        WHERE v.procedure = y.id AND v.kind = 'vetoes'
          AND NOT EXISTS (SELECT FROM motion.party w WHERE w.procedure = x.id AND w.kind = 'vetoes' AND w.grantee = v.grantee)
      ) AND CASE
        WHEN x.share_num IS NULL AND y.share_num IS NULL THEN true
        WHEN y.share_num IS NULL THEN 2 * x.share_num > x.share_den
        WHEN x.share_num IS NULL THEN 2 * y.share_num <= y.share_den
        ELSE x.share_num::bigint * y.share_den >= y.share_num::bigint * x.share_den
      END))
      AND (motion.consults(y.id) IS NULL OR motion.consults(x.id) = motion.consults(y.id))
    )
    FROM motion.procedure x, motion.procedure y
    WHERE x.id = as_strict.a AND y.id = as_strict.b
  ), false);
END;

-- What keeps a motion from replacing or ending a policy, or null: a
-- protected policy is replaced or ended only by a motion decided by the
-- procedure it names or a stricter one, and the reason says which.
CREATE FUNCTION motion.protection_flaw(ref text, by_motion text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r.id || ' is protected: only a motion decided by ' || r.protected || ', or by a stricter procedure, replaces or ends it, and '
    || d.id || ' is decided by ' || d.procedure
  FROM policy.policy r
  JOIN motion.motion d ON d.id = protection_flaw.by_motion
  WHERE r.id = protection_flaw.ref AND r.protected IS NOT NULL AND NOT motion.as_strict(d.procedure, r.protected);
END;

-- What keeps a policy of `circle` and `kind` applying from `day` from
-- replacing the policy `ref`, or null: `ref` is replaced already by a
-- policy other than `made`, the replacement's own id, and the reason
-- names that one and the day it applies, the one to replace instead; or
-- `ref` is no policy of that circle and kind in force on `day`, the end
-- `made` gave it aside, and the reason says the day it applies from or
-- ended on. `motion.asks` judges a proposal by it on the day the policy
-- would apply were the motion closed at its deadline, `motion.adopts` an
-- adoption on the day it applies, and the adoption's write asks it before
-- it writes the register, so a replacement settled while the motion was
-- open refuses the action with this reason, never an exception.
CREATE FUNCTION motion.replacement_flaw(circle text, kind text, ref text, day date, made text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(
    (SELECT q.id || ' replaces ' || q.replaces || ' already, from ' || to_char(q.applies, 'YYYY-MM-DD')
       || ': a policy replacing it now replaces ' || q.id || ' and applies on or after that day'
     FROM policy.policy q
     WHERE q.replaces = replacement_flaw.ref AND q.id IS DISTINCT FROM replacement_flaw.made),
    (SELECT 'no ' || replacement_flaw.kind || ' of ' || replacement_flaw.circle || ' in force on '
       || to_char(replacement_flaw.day, 'YYYY-MM-DD') || ' is ' || replacement_flaw.ref
       || coalesce(CASE
         WHEN o.circle <> replacement_flaw.circle OR o.kind <> replacement_flaw.kind THEN NULL
         WHEN o.applies > replacement_flaw.day THEN ': it applies from ' || to_char(o.applies, 'YYYY-MM-DD')
         ELSE ': it ended on ' || to_char(o.ends, 'YYYY-MM-DD') END, '')
     FROM (SELECT) x
     LEFT JOIN policy.policy o ON o.id = replacement_flaw.ref
     WHERE replacement_flaw.ref IS NOT NULL AND NOT coalesce(
       o.circle = replacement_flaw.circle AND o.kind = replacement_flaw.kind AND o.applies <= replacement_flaw.day
       AND (o.ends IS NULL OR o.ends > replacement_flaw.day
         OR EXISTS (SELECT FROM policy.policy r WHERE r.id = replacement_flaw.made AND r.replaces = o.id)), false))
  );
END;

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
-- kind, worded soundly for its kind (`policy.flaw`), a rule's ordered
-- values each saying which way is stricter, its days none before the
-- motion's deadline and its end after the day it would apply were the
-- motion closed then, and replaces, if it names one, a policy of the
-- motion's circle and kind in force that day and replaced by no other
-- (`motion.replacement_flaw`), not protected from it
-- (`motion.protection_flaw`), takes, if it names one, a default it is
-- worded and protected as (`policy.takes_flaw`) that no policy in force
-- it does not replace takes already, and is protected, if it names one, by a
-- procedure in force no looser than the motion's own; a procedure policy marks terms that
-- make a procedure (`motion.procedure_flaw`); and each policy it would
-- end is one of its circle in force on the verdict date, not protected
-- from it.
CREATE FUNCTION motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN coalesce(m.args ->> 'kind', '') NOT IN ('mandate', 'right', 'rule', 'procedure')
        THEN 'a policy is a mandate, a right, a rule or a procedure, not ' || coalesce(m.args ->> 'kind', 'nothing')
      WHEN policy.flaw(m.args ->> 'kind', m.args ->> 'wording', m.args ->> 'friendly') IS NOT NULL
        THEN policy.flaw(m.args ->> 'kind', m.args ->> 'wording', m.args ->> 'friendly')
      WHEN coalesce(m.args ->> 'from', '') !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
        OR coalesce(m.args ->> 'until', '') !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
        THEN 'a policy''s days are written YYYY-MM-DD'
      WHEN (m.args ->> 'from')::date < d.deadline
        THEN 'a policy applies at the earliest from ' || to_char(d.deadline, 'YYYY-MM-DD') || ', when ' || d.id || ' may close'
      WHEN (m.args ->> 'until')::date <= coalesce((m.args ->> 'from')::date, d.deadline)
        THEN 'a policy ends after the day it applies, ' || to_char(coalesce((m.args ->> 'from')::date, d.deadline), 'YYYY-MM-DD')
          || ' were ' || d.id || ' closed at its deadline'
      WHEN motion.replacement_flaw(d.circle, m.args ->> 'kind', nullif(m.args ->> 'replaces', ''), coalesce((m.args ->> 'from')::date, d.deadline), NULL) IS NOT NULL
        THEN motion.replacement_flaw(d.circle, m.args ->> 'kind', nullif(m.args ->> 'replaces', ''), coalesce((m.args ->> 'from')::date, d.deadline), NULL)
      WHEN m.args ? 'replaces' AND motion.protection_flaw(m.args ->> 'replaces', d.id) IS NOT NULL
        THEN motion.protection_flaw(m.args ->> 'replaces', d.id)
      WHEN policy.takes_flaw(nullif(m.args ->> 'takes', ''), m.args ->> 'kind', m.args ->> 'wording', m.args ->> 'friendly', m.args ->> 'protected') IS NOT NULL
        THEN policy.takes_flaw(nullif(m.args ->> 'takes', ''), m.args ->> 'kind', m.args ->> 'wording', m.args ->> 'friendly', m.args ->> 'protected')
      WHEN EXISTS (
        SELECT FROM policy.in_force(d.circle, cella.verdict_date()) f
        WHERE f.takes = m.args ->> 'takes' AND f.id IS DISTINCT FROM m.args ->> 'replaces'
      ) THEN (SELECT f.id FROM policy.in_force(d.circle, cella.verdict_date()) f WHERE f.takes = m.args ->> 'takes' LIMIT 1)
        || ' takes ' || (m.args ->> 'takes') || ' already: a policy taking it again replaces that one'
      WHEN m.args ->> 'kind' = 'procedure' AND motion.procedure_flaw(motion.marked(m.args ->> 'wording')) IS NOT NULL
        THEN motion.procedure_flaw(motion.marked(m.args ->> 'wording'))
      WHEN m.args ? 'protected' AND NOT EXISTS (
        SELECT FROM motion.procedure o LEFT JOIN policy.policy q ON q.id = o.policy
        WHERE o.id = m.args ->> 'protected'
          AND (o.policy IS NULL OR (q.applies <= cella.verdict_date() AND (q.ends IS NULL OR q.ends > cella.verdict_date())))
      ) THEN 'a policy is protected by a procedure in force, not ' || (m.args ->> 'protected')
      WHEN motion.as_strict(d.procedure, m.args ->> 'protected') AND NOT motion.as_strict(m.args ->> 'protected', d.procedure)
        THEN (m.args ->> 'protected') || ' is looser than ' || d.procedure || ', by which ' || d.id
          || ' is decided: a policy is protected by a procedure no looser than its own motion''s'
    END AS r
    FROM motion.action m
    JOIN motion.motion d ON d.id = m.motion
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'policy'
    UNION ALL
    SELECT CASE
      WHEN NOT EXISTS (SELECT FROM policy.in_force(d.circle, cella.verdict_date()) f WHERE f.id = m.args ->> 'policy')
        THEN 'no policy of ' || d.circle || ' in force is ' || coalesce(m.args ->> 'policy', 'named') || ': a policy is ended by its own circle'
      WHEN motion.protection_flaw(m.args ->> 'policy', d.id) IS NOT NULL
        THEN motion.protection_flaw(m.args ->> 'policy', d.id)
    END
    FROM motion.action m
    JOIN motion.motion d ON d.id = m.motion
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'end'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

-- motion:policy:adopt — the register's policy is the one the cited
-- motion's action carries: of its circle, of that kind, worded as the
-- motion names it (by the hash of its wordings, never by reading them
-- back), applying from the day the action names, or the verdict date,
-- whichever is later, and until the day it names, which is after that
-- however late the motion closed; a policy it replaces is in force that
-- day and replaced by no other (`motion.replacement_flaw`), and ends that
-- day; it is protected as the action names, and the
-- policy it replaces is not protected from the motion; it takes the
-- default the action names, worded and protected as that default reads;
-- the entry commits to its hash; and a procedure
-- policy has made the procedure its values say.
CREATE FUNCTION motion.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN m.kind IS DISTINCT FROM 'policy' THEN d.id || ' adopts no policy as its action ' || coalesce(p.n::text, '?')
    WHEN (m.args ->> 'until')::date <= greatest(coalesce((m.args ->> 'from')::date, cella.verdict_date()), cella.verdict_date())
      THEN d.id || '/' || m.n || ' would end on ' || (m.args ->> 'until') || ', not after '
        || to_char(greatest(coalesce((m.args ->> 'from')::date, cella.verdict_date()), cella.verdict_date()), 'YYYY-MM-DD')
        || ', the day it applies: a policy ends after the day it applies'
    WHEN motion.replacement_flaw(d.circle, m.args ->> 'kind', nullif(m.args ->> 'replaces', ''),
        greatest(coalesce((m.args ->> 'from')::date, cella.verdict_date()), cella.verdict_date()), d.id || '/' || m.n) IS NOT NULL
      THEN d.id || '/' || m.n || ' does not replace ' || (m.args ->> 'replaces') || ': '
        || motion.replacement_flaw(d.circle, m.args ->> 'kind', nullif(m.args ->> 'replaces', ''),
          greatest(coalesce((m.args ->> 'from')::date, cella.verdict_date()), cella.verdict_date()), d.id || '/' || m.n)
    WHEN r.id IS NULL OR r.id IS DISTINCT FROM p.policy THEN d.id || ' adopted no policy '|| coalesce(p.policy, '') || ' by this write'
    WHEN r.circle <> d.circle OR r.kind <> m.args ->> 'kind' OR r.motion <> d.id OR r.n <> m.n
      OR r.hash <> policy.hash(m.args ->> 'wording', m.args ->> 'friendly')
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
    WHEN r.protected IS DISTINCT FROM m.args ->> 'protected' THEN r.id || ' is not protected as ' || d.id || ' names'
    WHEN r.takes IS DISTINCT FROM nullif(m.args ->> 'takes', '') THEN r.id || ' does not take the default ' || d.id || ' names'
    WHEN policy.takes_flaw(r.takes, r.kind, m.args ->> 'wording', m.args ->> 'friendly', r.protected) IS NOT NULL
      THEN policy.takes_flaw(r.takes, r.kind, m.args ->> 'wording', m.args ->> 'friendly', r.protected)
    WHEN r.replaces IS NOT NULL AND motion.protection_flaw(r.replaces, d.id) IS NOT NULL
      THEN motion.protection_flaw(r.replaces, d.id)
    WHEN r.kind = 'procedure' AND NOT EXISTS (
      SELECT FROM motion.procedure o, motion.terms(motion.marked_by(r.id)) t
      WHERE o.policy = r.id AND o.id = t.id
        AND (o.method, o.share_num, o.share_den, o.quorum_num, o.quorum_den, o.ballot)
          IS NOT DISTINCT FROM (t.method, t.share_num, t.share_den, t.quorum_num, t.quorum_den, t.ballot)
        AND motion.parties(o.id) = ARRAY(SELECT n.kind || ' ' || n.grantee FROM motion.named(t.voters, t.veto, t.consult) n ORDER BY 1)
    ) THEN r.id || ' makes no procedure on the terms it marks'
  END
  FROM (SELECT payload ->> 'motion' AS motion, (payload ->> 'n')::integer AS n, payload ->> 'policy' AS policy, payload ->> 'hash' AS hash) p
  LEFT JOIN motion.motion d ON d.id = p.motion
  LEFT JOIN motion.action m ON m.motion = d.id AND m.n = p.n
  LEFT JOIN policy.policy r ON r.motion = d.id AND r.n = p.n;
END;

-- motion:policy:end — the register's policy is the one the cited motion's
-- action names, of the motion's circle, ended on the verdict date by that
-- action, and the entry names it and the day; and it is not protected
-- from the motion.
CREATE FUNCTION motion.ends(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN m.kind IS DISTINCT FROM 'end' THEN d.id || ' ends no policy as its action ' || coalesce(p.n::text, '?')
    WHEN r.id IS NULL OR r.id IS DISTINCT FROM p.policy THEN d.id || ' ends no policy ' || coalesce(p.policy, '')
    WHEN r.circle <> d.circle THEN r.id || ' is not ' || d.circle || '''s to end'
    WHEN r.ends IS DISTINCT FROM cella.verdict_date() OR r.ended_by IS DISTINCT FROM d.id || '/' || m.n
      OR p.ends IS DISTINCT FROM to_char(cella.verdict_date(), 'YYYY-MM-DD')
      THEN r.id || ' was not ended by this write'
    WHEN motion.protection_flaw(r.id, d.id) IS NOT NULL THEN motion.protection_flaw(r.id, d.id)
  END
  FROM (SELECT payload ->> 'motion' AS motion, (payload ->> 'n')::integer AS n, payload ->> 'policy' AS policy, payload ->> 'ends' AS ends) p
  LEFT JOIN motion.motion d ON d.id = p.motion
  LEFT JOIN motion.action m ON m.motion = d.id AND m.n = p.n
  LEFT JOIN policy.policy r ON r.id = m.args ->> 'policy';
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('motion:motion:propose', 'motion.asks(jsonb)', 'motion'),
  ('motion:motion:propose', 'motion.decides_by(jsonb)', 'motion'),
  ('motion:policy:adopt', 'motion.adopts(jsonb)', 'motion'),
  ('motion:policy:end', 'motion.ends(jsonb)', 'motion');
