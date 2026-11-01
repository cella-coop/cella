-- What a motion may decide of a year's split, registered with the
-- motion feat so its New form offers it: approving a drafted
-- distribution, picked from those this graft adds to the form
-- (`options`).
SELECT motion.register_carries('distribution', 'Approve a year''s distribution', '[{"name": "distribution", "label": "Distribution", "type": "text", "options": "distributions"}]', 'motion-patronage');

-- An action to approve a distribution names a draft not yet approved,
-- whatever wrote it; the approval it asks for is recorded with it. A
-- draft moved again, after a motion that failed, is approved by the
-- latest motion moving to.
CREATE FUNCTION motion_patronage.moved_to_approve() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind <> 'distribution' THEN
    RETURN NEW;
  END IF;
  INSERT INTO motion_patronage.approval (distribution, motion)
  SELECT l.id, NEW.motion FROM patronage.distribution l WHERE l.id = NEW.args ->> 'distribution' AND l.approved IS NULL
  ON CONFLICT (distribution) DO UPDATE SET motion = excluded.motion;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no drafted distribution % to approve', coalesce(NEW.args ->> 'distribution', 'is named')
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER approves_patronage_distribution AFTER INSERT ON motion.action
  FOR EACH ROW EXECUTE FUNCTION motion_patronage.moved_to_approve();

-- motion:motion:propose — each action to approve a distribution names
-- a draft not yet approved, and the motion is the one asking to approve
-- it.
CREATE FUNCTION motion_patronage.asks_to_approve(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN l.id IS NULL THEN 'no distribution ' || coalesce(m.args ->> 'distribution', 'is named') || ' to approve'
      WHEN l.approved IS NOT NULL THEN l.id || ' was approved on ' || to_char(l.approved, 'YYYY-MM-DD')
      WHEN a.motion IS DISTINCT FROM m.motion THEN m.motion || ' does not ask to approve ' || l.id
    END AS r
    FROM motion.action m
    LEFT JOIN patronage.distribution l ON l.id = m.args ->> 'distribution'
    LEFT JOIN motion_patronage.approval a ON a.distribution = l.id
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'distribution'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:propose', 'motion_patronage.asks_to_approve(jsonb)', 'motion-patronage');

GRANT UPDATE (motion) ON motion_patronage.approval TO cella_app;
