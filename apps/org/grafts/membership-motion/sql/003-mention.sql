-- The member a handle in a motion's message names: the one whose address
-- it is, or, for a handle with no `@`, the one whose address starts with
-- it; none where it names no one, or more than one.
CREATE FUNCTION membership_motion.named(handle text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE WHEN count(*) = 1 THEN min(m.address) END
  FROM membership.member m
  WHERE m.address = lower(handle)
     OR (strpos(handle, '@') = 0 AND split_part(m.address, '@', 1) = lower(handle));
END;

-- Who each message mentions, by the handles its text gives.
CREATE VIEW membership_motion.mention AS
SELECT x.receipt AS message, x.motion, x.member AS author, h.handle, membership_motion.named(h.handle) AS member, x.at
FROM motion.message x
CROSS JOIN LATERAL unnest(x.mentions) AS h(handle);

-- motion:message:post — each handle the message mentions names one
-- member.
CREATE FUNCTION membership_motion.mentions(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT '@' || h.handle || ' names no one member'
  FROM jsonb_array_elements_text(coalesce(payload -> 'mentions', '[]')) AS h(handle)
  WHERE membership_motion.named(h.handle) IS NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:message:post', 'membership_motion.mentions(jsonb)', 'membership-motion');

GRANT SELECT ON membership_motion.mention TO cella_app, cella_guards;
