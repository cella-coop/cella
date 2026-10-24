-- decision:decision:vote — a stance is the actor's own: no member votes for
-- another. Whether the actor is on the decision's roll is the
-- circle-decision-member graft's rule on the same op.
CREATE FUNCTION decision.own_stance(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.member IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not vote for ' || coalesce(p.member, 'no one')
  END
  FROM (SELECT payload ->> 'member' AS member) p;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('decision:decision:vote', 'decision.own_stance(jsonb)', 'decision');
