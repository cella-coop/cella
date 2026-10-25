-- A decision's deliberation: the messages its circle's members post while
-- it is open, ordered by receipt, each a reply to another of the same
-- decision or not. A message names the members it mentions by the handle
-- its text gives (`@amina`, or a whole address) and the documents it links
-- (`[[internal-rules]]`), which the grafts joining members and documents
-- resolve and check; the text is its author's words and stays out of the
-- log, as a proposal's does.
CREATE TABLE decision.message (
  receipt bigint PRIMARY KEY,
  decision text NOT NULL REFERENCES decision.decision,
  member text NOT NULL,
  reply bigint,
  body text NOT NULL CHECK (btrim(body) <> ''),
  mentions text[] NOT NULL DEFAULT '{}',
  links text[] NOT NULL DEFAULT '{}',
  at date NOT NULL,
  UNIQUE (decision, receipt),
  FOREIGN KEY (decision, reply) REFERENCES decision.message (decision, receipt),
  CHECK (reply < receipt)
);

CREATE INDEX ON decision.message (decision);

-- A closed decision takes no more messages, as it takes no more stances.
CREATE TRIGGER open_for_messages BEFORE INSERT ON decision.message
  FOR EACH ROW EXECUTE FUNCTION decision.open_for_votes();

-- decision:message:post — the message is the actor's own, and mentions and
-- links what its payload names. That the actor sits in the decision's
-- circle is circle-decision-membership's rule on the same op; that each
-- mention is a member's and each link a document's, decision-membership's and
-- decision-document's.
CREATE FUNCTION decision.posts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.receipt IS NULL THEN 'no message ' || coalesce(p.message, 'is named')
    WHEN m.member IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not post as ' || m.member
    WHEN m.decision IS DISTINCT FROM p.decision
      OR m.reply IS DISTINCT FROM p.reply
      OR m.mentions IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(coalesce(p.mentions, '[]')))
      OR m.links IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(coalesce(p.links, '[]')))
      THEN 'message ' || m.receipt || ' was posted otherwise than its payload names'
  END
  FROM (
    SELECT payload ->> 'message' AS message, payload ->> 'decision' AS decision, (payload ->> 'reply')::bigint AS reply,
           payload -> 'mentions' AS mentions, payload -> 'links' AS links
  ) p
  LEFT JOIN decision.message m ON m.receipt::text = p.message;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('decision:message:post', 'decision.posts(jsonb)', 'decision');

GRANT SELECT, INSERT ON decision.message TO cella_app;
GRANT SELECT ON decision.message TO cella_rules;
