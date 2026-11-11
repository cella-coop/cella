-- The founders of a co-op founded by a motion: the members whose
-- membership began by the day it closed; whether each sat in its circle
-- with a vote that day, a seat counting then and, where its procedure
-- has roles that vote, holding one (`motion.votes`); and whether each gave it a
-- stance before its cutoff.
CREATE FUNCTION membership_motion.founders(ref text) RETURNS TABLE (member text, seated boolean, decided boolean)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT b.address,
    circle_person.sits_in(b.address, d.circle, d.closed) AND EXISTS (
      SELECT FROM circle.seat s
      JOIN motion.procedure p ON p.id = d.procedure
      WHERE s.circle = d.circle AND s.member = b.address
        AND (s.since IS NULL OR s.since <= d.closed)
        AND (s.until IS NULL OR s.until > d.closed)
        AND motion.votes(p.id, s.role)
    ),
    EXISTS (
      SELECT FROM motion.vote v
      WHERE v.motion = d.id AND v.member = b.address AND v.receipt < d.cutoff AND v.stance <> 'redacted'
    )
  FROM motion.motion d
  JOIN membership.member b ON b.since <= d.closed AND b.status <> 'invited'
  WHERE d.id = ref AND d.closed IS NOT NULL;
END;

-- membership-motion:scope:found — the founding, the log's first
-- entry, its check `first`: refused once the log holds any, so a co-op is
-- founded once. It names the legal form the co-op chose, one cella
-- offers, and its policies take that form's defaults and no other form's,
-- at least one of them. Once its state is written, the co-op can decide:
-- one assembly, deciding by a procedure a policy in force there makes,
-- never only one every scope starts with. It names its founding motion,
-- the root's, closed, carried by its procedure as its roll counts it, and
-- the one that adopted every policy taking a default; its founders, the
-- members whose membership began by the day it closed, each sit in the
-- root with a vote that day and gave a stance on it; and the founder who
-- signs it sits there with a vote, their seat counting on the verdict
-- date and, where the procedure names the roles that vote, in one of
-- them. A refusal names no one, and a founding refused leaves the log
-- empty.
CREATE FUNCTION membership_motion.founds(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN x.n > 0 THEN 'a co-op is founded once, as its log''s first entry; the log holds ' || x.n || ' already'
    WHEN f.id IS NULL THEN 'founded as ' || coalesce(x.form, 'no form') || ', which is no legal form cella offers'
    WHEN EXISTS (SELECT FROM policy.policy p JOIN policy.default d ON d.id = p.takes WHERE d.form <> f.id)
      THEN 'founded as ' || f.id || ', but a policy takes the default of another form'
    WHEN NOT EXISTS (SELECT FROM policy.policy p JOIN policy.default d ON d.id = p.takes WHERE d.form = f.id)
      THEN 'founded as ' || f.id || ', but no policy takes one of its defaults'
    WHEN x.roots <> 1 THEN 'a co-op is founded with one assembly; this founding makes ' || x.roots
    WHEN NOT EXISTS (
      SELECT FROM motion.procedure p
      JOIN policy.in_force(r.id, cella.verdict_date()) i ON i.id = p.policy AND i.kind = 'procedure'
      WHERE p.id = r.procedure
    ) THEN r.id || ' decides by ' || r.procedure || ', which no policy in force there makes: a co-op is founded with the procedure its root decides by'
    WHEN x.motion IS NULL
      THEN 'the founding names no founding motion: it names the motion of ' || r.id || ' that adopted the form''s defaults'
    WHEN m.id IS NULL
      THEN 'the founding names ' || x.motion || ', which is no motion: it names the motion of ' || r.id || ' that adopted the form''s defaults'
    WHEN m.circle <> r.id
      THEN x.motion || ' is a motion of ' || m.circle || ', not of ' || r.id || ': a co-op is founded by a motion of its root'
    WHEN m.closed IS NULL
      THEN m.id || ' is not closed: a co-op is founded by a motion its founders closed'
    WHEN NOT coalesce(motion.passes(m.id), false)
      THEN m.id || ' is not carried by ' || m.procedure || ' as its roll counts it: a co-op is founded by a motion its founders carried'
    WHEN EXISTS (SELECT FROM policy.policy p WHERE p.takes IS NOT NULL AND p.motion <> m.id)
      THEN (SELECT p.id || ' takes ' || p.takes || ' but was adopted by ' || p.motion || ', not ' || m.id
                   || ': the founding motion adopts every policy taking a default of the form'
            FROM policy.policy p WHERE p.takes IS NOT NULL AND p.motion <> m.id ORDER BY p.id LIMIT 1)
    WHEN NOT EXISTS (SELECT FROM membership_motion.founders(m.id))
      THEN m.id || ' closed on ' || to_char(m.closed, 'YYYY-MM-DD') || ' with no member whose membership began by then: its founders are members by the day it closes'
    WHEN EXISTS (SELECT FROM membership_motion.founders(m.id) o WHERE NOT o.seated)
      THEN (SELECT count(*) FROM membership_motion.founders(m.id) o WHERE NOT o.seated) || ' of the '
           || (SELECT count(*) FROM membership_motion.founders(m.id)) || ' founders, the members whose membership began by '
           || to_char(m.closed, 'YYYY-MM-DD') || ', had no seat with a vote in ' || r.id
           || ' that day: seat every founder in the root, in a role that votes by ' || m.procedure
    WHEN EXISTS (SELECT FROM membership_motion.founders(m.id) o WHERE NOT o.decided)
      THEN (SELECT count(*) FROM membership_motion.founders(m.id) o WHERE NOT o.decided) || ' of the '
           || (SELECT count(*) FROM membership_motion.founders(m.id)) || ' founders gave no stance on ' || m.id
           || ': its founders decide their founding motion, each with a stance before it closes'
    WHEN NOT EXISTS (SELECT FROM membership_motion.founders(m.id) o WHERE o.member = cella.actor())
      THEN 'the founding''s signer is none of its founders: a founder, a member by ' || to_char(m.closed, 'YYYY-MM-DD') || ', signs it'
    WHEN NOT circle_person.sits_in(cella.actor(), r.id, cella.verdict_date())
      THEN 'the founding''s signer does not sit in ' || r.id || ': a founder seated there signs it'
    WHEN NOT EXISTS (
      SELECT FROM circle.seat s
      JOIN motion.procedure p ON p.id = r.procedure
      WHERE s.circle = r.id AND s.member = cella.actor()
        AND (s.since IS NULL OR s.since <= cella.verdict_date())
        AND (s.until IS NULL OR s.until > cella.verdict_date())
        AND motion.votes(p.id, s.role)
    ) THEN 'the founding''s signer has no vote in ' || r.id || ': a founder seated in a role that votes by ' || r.procedure || ' signs it'
  END
  FROM (
    SELECT payload ->> 'form' AS form, nullif(payload ->> 'motion', '') AS motion,
           coalesce((SELECT h.n FROM cella.head h), 0) AS n,
           (SELECT count(*) FROM circle.circle c WHERE c.assembly) AS roots
  ) x
  LEFT JOIN policy.form f ON f.id = x.form
  LEFT JOIN circle.circle r ON r.assembly AND x.roots = 1
  LEFT JOIN motion.motion m ON m.id = x.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('membership-motion:scope:found', 'membership_motion.founds(jsonb)', 'membership-motion');
