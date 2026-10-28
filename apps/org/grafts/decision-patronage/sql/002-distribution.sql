-- What a decision may decide of a year's split, registered with the
-- decision feat so its New form offers it: approving a drafted
-- distribution, picked from those this graft adds to the form
-- (`options`).
INSERT INTO decision.kind (kind, label, fields, owner) VALUES
  ('distribution', 'Approve a year''s distribution', '[{"name": "distribution", "label": "Distribution", "type": "text", "options": "distributions"}]', 'decision-patronage');

-- A motion to approve a distribution names a draft not yet approved,
-- whatever wrote it; the approval it asks for is recorded with it. A
-- draft moved again, after a decision that failed, is approved by the
-- latest decision moving to.
CREATE FUNCTION decision_patronage.moved_to_approve() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind <> 'distribution' THEN
    RETURN NEW;
  END IF;
  INSERT INTO decision_patronage.approval (distribution, decision)
  SELECT l.id, NEW.decision FROM patronage.distribution l WHERE l.id = NEW.args ->> 'distribution' AND l.approved IS NULL
  ON CONFLICT (distribution) DO UPDATE SET decision = excluded.decision;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no drafted distribution % to approve', coalesce(NEW.args ->> 'distribution', 'is named')
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER approves_patronage_distribution AFTER INSERT ON decision.motion
  FOR EACH ROW EXECUTE FUNCTION decision_patronage.moved_to_approve();

-- decision:decision:propose — each motion to approve a distribution names
-- a draft not yet approved, and the decision is the one asking to approve
-- it.
CREATE FUNCTION decision_patronage.asks_to_approve(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN l.id IS NULL THEN 'no distribution ' || coalesce(m.args ->> 'distribution', 'is named') || ' to approve'
      WHEN l.approved IS NOT NULL THEN l.id || ' was approved on ' || to_char(l.approved, 'YYYY-MM-DD')
      WHEN a.decision IS DISTINCT FROM m.decision THEN m.decision || ' does not ask to approve ' || l.id
    END AS r
    FROM decision.motion m
    LEFT JOIN patronage.distribution l ON l.id = m.args ->> 'distribution'
    LEFT JOIN decision_patronage.approval a ON a.distribution = l.id
    WHERE m.decision = payload ->> 'decision' AND m.kind = 'distribution'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('decision:decision:propose', 'decision_patronage.asks_to_approve(jsonb)', 'decision-patronage');

GRANT UPDATE (decision) ON decision_patronage.approval TO cella_app;
