-- The member a handle in a decision's message names: the one whose address
-- it is, or, for a handle with no `@`, the one whose address starts with
-- it; none where it names no one, or more than one.
CREATE FUNCTION decision_member.named(handle text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE WHEN count(*) = 1 THEN min(m.address) END
  FROM member.member m
  WHERE m.address = lower(handle)
     OR (strpos(handle, '@') = 0 AND split_part(m.address, '@', 1) = lower(handle));
END;

-- Who each message mentions, by the handles its text gives.
CREATE VIEW decision_member.mention AS
SELECT x.receipt AS message, x.decision, x.member AS author, h.handle, decision_member.named(h.handle) AS member, x.at
FROM decision.message x
CROSS JOIN LATERAL unnest(x.mentions) AS h(handle);

-- decision:message:post — each handle the message mentions names one
-- member.
CREATE FUNCTION decision_member.mentions(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT '@' || h.handle || ' names no one member'
  FROM jsonb_array_elements_text(coalesce(payload -> 'mentions', '[]')) AS h(handle)
  WHERE decision_member.named(h.handle) IS NULL
  LIMIT 1;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('decision:message:post', 'decision_member.mentions(jsonb)', 'decision-member');

GRANT SELECT ON decision_member.mention TO cella_app, cella_rules;
