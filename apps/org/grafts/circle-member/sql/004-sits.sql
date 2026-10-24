-- circle:circle:message — the actor is an active member seated in the
-- circle on the verdict date: a circle's channel is its members'.
CREATE FUNCTION circle_member.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (SELECT FROM circle_member.seated(p.circle, cella.verdict_date()) s WHERE s = cella.actor())
      OR NOT EXISTS (SELECT FROM member.member m WHERE m.address = cella.actor() AND m.status = 'active')
      THEN cella.actor() || ' holds no seat in ' || coalesce(p.circle, 'no circle')
  END
  FROM (SELECT payload ->> 'circle' AS circle) p;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('circle:circle:message', 'circle_member.sits(jsonb)', 'circle-member');

-- A seat ends by `circle-member:position:remove`, on the verdict date; it
-- keeps its row, so who sat where reads back. Both writes are decided:
-- circle-decision-member, which joins the decision, judges them.
GRANT UPDATE (until) ON circle_member.position TO cella_app;
