-- graft decision_member: its own schema, the decision and member feats, cella.*
CREATE FUNCTION decision_member.two_thirds(d text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 3 * ((t ->> 'for')::int + (t ->> 'consent')::int)
         >= 2 * (SELECT count(*) FROM member.member m WHERE m.status = 'active')
  FROM (SELECT cella.tally(v.member, v.stance ORDER BY v.at) AS t FROM decision.vote v WHERE v.decision = d) x;
END;
