CREATE SCHEMA motion_patronage;

-- The motion of the members that approves a year's distribution. Both
-- sides are referenced by id, with no foreign key into either feat.
CREATE TABLE motion_patronage.approval (
  distribution text PRIMARY KEY,
  motion text NOT NULL
);

-- patronage:distribution:approve — the cited motion is the one that
-- approves this distribution. That it closed and passed on its roll is
-- circle-membership-motion's guard, attached through motion.cites.
CREATE FUNCTION motion_patronage.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN a.motion IS DISTINCT FROM d.id THEN d.id || ' does not approve ' || coalesce(p.distribution, 'a distribution')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'distribution' AS distribution) p
  LEFT JOIN motion.motion d ON d.id = p.motion
  LEFT JOIN motion_patronage.approval a ON a.distribution = p.distribution;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:distribution:approve', 'motion_patronage.approves(jsonb)', 'motion-patronage');
SELECT motion.register_cite('patronage:distribution:approve', 'motion-patronage');

-- What a motion may decide of the work share's terms, registered with
-- the motion feat so its New form offers it: adopting drafted terms,
-- picked from those this graft adds to the form (`options`).
SELECT motion.register_carries('patronage', 'Adopt the work share''s terms', '[{"name": "terms", "label": "Terms", "type": "text", "options": "bases"}]', 'motion-patronage');

-- The motion of the members that adopts terms, as its action names
-- them. Both sides are referenced by id, with no foreign key into either
-- feat.
CREATE TABLE motion_patronage.adoption (
  terms text NOT NULL,
  motion text NOT NULL,
  PRIMARY KEY (terms, motion)
);

-- An action to adopt terms names terms that exist and are not adopted
-- yet, whatever wrote it; the adoption it asks for is recorded with it.
CREATE FUNCTION motion_patronage.moved() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind <> 'patronage' THEN
    RETURN NEW;
  END IF;
  INSERT INTO motion_patronage.adoption (terms, motion)
  SELECT t.id, NEW.motion FROM patronage.terms t WHERE t.id = NEW.args ->> 'terms' AND t.adopted IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no terms % to adopt', coalesce(NEW.args ->> 'terms', 'are named')
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER adopts_patronage_terms AFTER INSERT ON motion.action
  FOR EACH ROW EXECUTE FUNCTION motion_patronage.moved();

-- motion:motion:propose — each action to adopt terms names terms not
-- yet adopted, and the motion asks to adopt them.
CREATE FUNCTION motion_patronage.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN t.id IS NULL THEN 'no terms ' || coalesce(m.args ->> 'terms', 'are named') || ' to adopt'
      WHEN t.adopted IS NOT NULL THEN t.id || ' were adopted on ' || to_char(t.adopted, 'YYYY-MM-DD')
      WHEN a.motion IS NULL THEN m.motion || ' does not ask to adopt ' || t.id
    END AS r
    FROM motion.action m
    LEFT JOIN patronage.terms t ON t.id = m.args ->> 'terms'
    LEFT JOIN motion_patronage.adoption a ON a.motion = m.motion AND a.terms = t.id
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'patronage'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:propose', 'motion_patronage.asks(jsonb)', 'motion-patronage');

-- patronage:terms:adopt — the cited motion moved to adopt these terms.
-- That it closed and passed on its roll is circle-membership-motion's guard,
-- attached through motion.cites.
CREATE FUNCTION motion_patronage.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (SELECT FROM motion_patronage.adoption a WHERE a.terms = p.terms AND a.motion = d.id)
      THEN d.id || ' does not adopt ' || coalesce(p.terms, 'these terms')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'terms' AS terms) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:terms:adopt', 'motion_patronage.adopts(jsonb)', 'motion-patronage');
SELECT motion.register_cite('patronage:terms:adopt', 'motion-patronage');

GRANT USAGE ON SCHEMA motion_patronage TO cella_app, cella_guards;
GRANT SELECT, INSERT ON motion_patronage.approval, motion_patronage.adoption TO cella_app;
GRANT SELECT ON motion_patronage.approval, motion_patronage.adoption TO cella_guards;
