-- The member a handle in a decision's message names: the one whose address
-- it is, or, for a handle with no `@`, the one whose address starts with
-- it; none where it names no one, or more than one.
CREATE FUNCTION decision_membership.named(handle text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE WHEN count(*) = 1 THEN min(m.address) END
  FROM membership.member m
  WHERE m.address = lower(handle)
     OR (strpos(handle, '@') = 0 AND split_part(m.address, '@', 1) = lower(handle));
END;

-- Who each message mentions, by the handles its text gives.
CREATE VIEW decision_membership.mention AS
SELECT x.receipt AS message, x.decision, x.member AS author, h.handle, decision_membership.named(h.handle) AS member, x.at
FROM decision.message x
CROSS JOIN LATERAL unnest(x.mentions) AS h(handle);

-- decision:message:post — each handle the message mentions names one
-- member.
CREATE FUNCTION decision_membership.mentions(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT '@' || h.handle || ' names no one member'
  FROM jsonb_array_elements_text(coalesce(payload -> 'mentions', '[]')) AS h(handle)
  WHERE decision_membership.named(h.handle) IS NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('decision:message:post', 'decision_membership.mentions(jsonb)', 'decision-membership');

GRANT SELECT ON decision_membership.mention TO cella_app, cella_guards;
