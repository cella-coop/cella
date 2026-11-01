-- circle:circle:message — the actor is an active member seated in the
-- circle on the verdict date: the participant's `discuss`, which `may`
-- finds on any seat, is held in the circle the message is posted to.
CREATE FUNCTION circle_membership.sits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (SELECT FROM circle_membership.seated(p.circle, cella.verdict_date()) s WHERE s = cella.actor())
      OR NOT EXISTS (SELECT FROM membership.member m WHERE m.address = cella.actor() AND m.status = 'active')
      THEN cella.actor() || ' holds no seat in ' || coalesce(p.circle, 'no circle')
  END
  FROM (SELECT payload ->> 'circle' AS circle) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('circle:circle:message', 'circle_membership.sits(jsonb)', 'circle-membership');

-- A seat ends by `circle-membership:seat:remove`, on the verdict date; it
-- keeps its row, so who sat where reads back. Both writes are decided:
-- circle-membership-motion, which joins the motion, judges them.
GRANT UPDATE (until) ON circle_membership.seat TO cella_app;
