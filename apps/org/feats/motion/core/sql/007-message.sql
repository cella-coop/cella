-- A motion's deliberation: the messages its circle's members post while
-- it is open, ordered by receipt, each a reply to another of the same
-- motion or not. A message names the members it mentions by the handle
-- its text gives (`@amina`, or a whole address) and the documents it links
-- (`[[internal-rules]]`), which the grafts joining members and documents
-- resolve and check; the text is its author's words and stays out of the
-- log, as a proposal's does.

-- A text's tokens in the order given, by the grammar models/thread.ts
-- draws it with: a handle starts after a space or at the start, so an
-- address in the text is no mention, and drops its trailing `._-`; a link
-- is a document's id in double brackets. Each is lowered.
CREATE FUNCTION motion.tokens(body text) RETURNS TABLE (n bigint, mention text, link text)
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT r.n, lower(rtrim(r.t[1], '._-')), lower(r.t[2])
  FROM regexp_matches(
    body,
    '(?<![A-Za-z0-9_.@])@([a-z0-9][a-z0-9._-]*(?:@[a-z0-9-]+(?:\.[a-z0-9-]+)+)?)|\[\[([a-z0-9][a-z0-9@._-]*)\]\]',
    'gi'
  ) WITH ORDINALITY AS r(t, n);
END;

-- The handles a text mentions and the documents it links, each once, in
-- the order given.
CREATE FUNCTION motion.mentions(body text) RETURNS text[]
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT coalesce(array_agg(mention ORDER BY n), '{}')
  FROM (SELECT mention, min(n) AS n FROM motion.tokens(body) WHERE mention IS NOT NULL GROUP BY mention) t;
END;

CREATE FUNCTION motion.links(body text) RETURNS text[]
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT coalesce(array_agg(link ORDER BY n), '{}')
  FROM (SELECT link, min(n) AS n FROM motion.tokens(body) WHERE link IS NOT NULL GROUP BY link) t;
END;

-- The mentions and the links are the text's: the table generates them, so
-- no row names one its text does not give, whatever its writer names.
CREATE TABLE motion.message (
  receipt bigint PRIMARY KEY,
  motion text NOT NULL REFERENCES motion.motion,
  member text NOT NULL,
  reply bigint,
  body text NOT NULL CHECK (btrim(body) <> ''),
  mentions text[] NOT NULL GENERATED ALWAYS AS (motion.mentions(body)) STORED,
  links text[] NOT NULL GENERATED ALWAYS AS (motion.links(body)) STORED,
  at date NOT NULL,
  UNIQUE (motion, receipt),
  FOREIGN KEY (motion, reply) REFERENCES motion.message (motion, receipt),
  CHECK (reply < receipt)
);

CREATE INDEX ON motion.message (motion);

-- A closed motion takes no more messages, as it takes no more stances.
CREATE TRIGGER open_for_messages BEFORE INSERT ON motion.message
  FOR EACH ROW EXECUTE FUNCTION motion.open_for_votes();

-- motion:message:post — the message is the actor's own, and mentions and
-- links what its payload names, which are its text's. That the actor sits in the motion's
-- circle is membership-motion's guard on the same op; that each
-- mention is a member's and each link a document's, membership-motion's and
-- document-motion's.
CREATE FUNCTION motion.posts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.receipt IS NULL THEN 'no message ' || coalesce(p.message, 'is named')
    WHEN m.member IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not post as ' || m.member
    WHEN m.motion IS DISTINCT FROM p.motion
      OR m.reply IS DISTINCT FROM p.reply
      OR m.mentions IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(coalesce(p.mentions, '[]')))
      OR m.links IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(coalesce(p.links, '[]')))
      THEN 'message ' || m.receipt || ' was posted otherwise than its payload names'
  END
  FROM (
    SELECT payload ->> 'message' AS message, payload ->> 'motion' AS motion, (payload ->> 'reply')::bigint AS reply,
           payload -> 'mentions' AS mentions, payload -> 'links' AS links
  ) p
  LEFT JOIN motion.message m ON m.receipt::text = p.message;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:message:post', 'motion.posts(jsonb)', 'motion');

GRANT SELECT, INSERT ON motion.message TO cella_app;
GRANT SELECT ON motion.message TO cella_guards;

-- What a motion's writes need, the participant's mandates in the motion's
-- circle: `propose` to propose one and close it, `discuss` to post on its
-- deliberation. The membership feat checks the actor holds the power,
-- membership-motion that they hold it in the motion's circle.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('motion:motion:propose', 'propose', NULL, 'motion'),
  ('motion:motion:close', 'propose', NULL, 'motion'),
  ('motion:message:post', 'discuss', NULL, 'motion');
