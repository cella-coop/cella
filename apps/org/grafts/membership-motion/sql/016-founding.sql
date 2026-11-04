-- membership-motion:scope:found — the founding, the log's first
-- entry, its check `first`: refused once the log holds any, so a co-op is
-- founded once. It names the legal form the co-op chose, one cella
-- offers, and its policies take that form's defaults and no other form's,
-- at least one of them. Once its state is written, the co-op can decide:
-- one assembly, deciding by a procedure a policy in force there makes,
-- never only one every scope starts with, and the founder who signs it
-- seated there with a vote, their seat counting on the verdict date and,
-- where the procedure names the roles that vote, in one of them. A
-- founding refused leaves the log empty.
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
    WHEN NOT membership.sits_in(cella.actor(), r.id, cella.verdict_date())
      THEN cella.actor() || ' signs the founding but does not sit in ' || r.id
    WHEN NOT EXISTS (
      SELECT FROM circle.seat s
      JOIN motion.procedure p ON p.id = r.procedure
      WHERE s.circle = r.id AND s.member = cella.actor()
        AND (s.since IS NULL OR s.since <= cella.verdict_date())
        AND (s.until IS NULL OR s.until > cella.verdict_date())
        AND (p.voters IS NULL OR 'participant' = ANY (p.voters) OR s.role = ANY (p.voters))
    ) THEN cella.actor() || ' signs the founding but has no vote in ' || r.id
  END
  FROM (
    SELECT payload ->> 'form' AS form, coalesce((SELECT h.n FROM cella.head h), 0) AS n,
           (SELECT count(*) FROM circle.circle c WHERE c.assembly) AS roots
  ) x
  LEFT JOIN policy.form f ON f.id = x.form
  LEFT JOIN circle.circle r ON r.assembly AND x.roots = 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('membership-motion:scope:found', 'membership_motion.founds(jsonb)', 'membership-motion');
