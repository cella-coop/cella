-- A motion's deliberation: the messages its circle's members post while
-- it is open, ordered by receipt, each a reply to another of the same
-- motion or not. A message names the members it mentions by the handle
-- its text gives (`@amina`, or a whole address) and the documents it links
-- (`[[internal-rules]]`), which the grafts joining members and documents
-- resolve and check; the text is its author's words and stays out of the
-- log, as a proposal's does.
CREATE TABLE motion.message (
  receipt bigint PRIMARY KEY,
  motion text NOT NULL REFERENCES motion.motion,
  member text NOT NULL,
  reply bigint,
  body text NOT NULL CHECK (btrim(body) <> ''),
  mentions text[] NOT NULL DEFAULT '{}',
  links text[] NOT NULL DEFAULT '{}',
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
-- links what its payload names. That the actor sits in the motion's
-- circle is circle-membership-motion's guard on the same op; that each
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
