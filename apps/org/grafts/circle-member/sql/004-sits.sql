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

-- Ending a seat is the circle's decision once its junction exists; until
-- then it needs a power no Lanterne mandate grants.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('circle-member:position:remove', 'appoint', NULL, 'circle-member');
