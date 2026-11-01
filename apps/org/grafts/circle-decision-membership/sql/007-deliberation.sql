-- decision:message:post — the author is an active member seated in the
-- decision's circle on the verdict date: a circle's members deliberate on
-- its decisions, as they put and close them.
INSERT INTO cella.guard (op, fn, owner) VALUES
  ('decision:message:post', 'circle_decision_membership.sits(jsonb)', 'circle-decision-membership');
