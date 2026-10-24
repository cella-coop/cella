-- feat decision: its own schema and cella.* only
CREATE FUNCTION decision.consented(d text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT cella.consent(v.member, v.stance ORDER BY v.at) FROM decision.vote v WHERE v.decision = d;
END;

-- refused: reaches into the member feat; this rule belongs in the decision_member graft
CREATE FUNCTION decision.two_thirds(d text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 3 * ((t ->> 'for')::int + (t ->> 'consent')::int)
         >= 2 * (SELECT count(*) FROM member.member m WHERE m.status = 'active')
  FROM (SELECT cella.tally(v.member, v.stance ORDER BY v.at) AS t FROM decision.vote v WHERE v.decision = d) x;
END;

-- refused: a rule never reads the clock
CREATE FUNCTION decision.overdue(d text) RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT count(*) = 0 FROM decision.vote v WHERE v.decision = d AND v.at > now() - interval '28 days' $$;

-- refused: current_date is the clock in disguise, random() is not deterministic
CREATE FUNCTION decision.lottery(d text) RETURNS boolean
LANGUAGE sql VOLATILE
RETURN random() < 0.5 AND current_date > date '2026-01-01';
