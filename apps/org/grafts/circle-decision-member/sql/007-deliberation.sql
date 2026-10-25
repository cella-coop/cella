-- decision:message:post — the author is an active member seated in the
-- decision's circle on the verdict date: a circle's members deliberate on
-- its decisions, as they put and close them.
INSERT INTO cella.rule (op, fn, owner) VALUES
  ('decision:message:post', 'circle_decision_member.sits(jsonb)', 'circle-decision-member');
