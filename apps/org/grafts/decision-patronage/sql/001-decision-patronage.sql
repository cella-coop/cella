CREATE SCHEMA decision_patronage;

-- The decision of the members that approves a year's distribution. Both
-- sides are referenced by id, with no foreign key into either feat.
CREATE TABLE decision_patronage.approval (
  distribution text PRIMARY KEY,
  decision text NOT NULL
);

-- patronage:distribution:approve — the cited decision is the one that
-- approves this distribution. That it closed and passed on its roll is
-- circle-decision-membership's guard, attached through decision.cites.
CREATE FUNCTION decision_patronage.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN a.decision IS DISTINCT FROM d.id THEN d.id || ' does not approve ' || coalesce(p.distribution, 'a distribution')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'distribution' AS distribution) p
  LEFT JOIN decision.decision d ON d.id = p.decision
  LEFT JOIN decision_patronage.approval a ON a.distribution = p.distribution;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:distribution:approve', 'decision_patronage.approves(jsonb)', 'decision-patronage');
INSERT INTO decision.cites (op, owner) VALUES ('patronage:distribution:approve', 'decision-patronage');

-- What a decision may decide of the work share's terms, registered with
-- the decision feat so its New form offers it: adopting drafted terms,
-- picked from those this graft adds to the form (`options`).
INSERT INTO decision.kind (kind, label, fields, owner) VALUES
  ('patronage', 'Adopt the work share''s terms', '[{"name": "terms", "label": "Terms", "type": "text", "options": "bases"}]', 'decision-patronage');

-- The decision of the members that adopts terms, as its motion names
-- them. Both sides are referenced by id, with no foreign key into either
-- feat.
CREATE TABLE decision_patronage.adoption (
  terms text NOT NULL,
  decision text NOT NULL,
  PRIMARY KEY (terms, decision)
);

-- A motion to adopt terms names terms that exist and are not adopted
-- yet, whatever wrote it; the adoption it asks for is recorded with it.
CREATE FUNCTION decision_patronage.moved() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind <> 'patronage' THEN
    RETURN NEW;
  END IF;
  INSERT INTO decision_patronage.adoption (terms, decision)
  SELECT t.id, NEW.decision FROM patronage.terms t WHERE t.id = NEW.args ->> 'terms' AND t.adopted IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no terms % to adopt', coalesce(NEW.args ->> 'terms', 'are named')
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER adopts_patronage_terms AFTER INSERT ON decision.motion
  FOR EACH ROW EXECUTE FUNCTION decision_patronage.moved();

-- decision:decision:propose — each motion to adopt terms names terms not
-- yet adopted, and the decision asks to adopt them.
CREATE FUNCTION decision_patronage.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN t.id IS NULL THEN 'no terms ' || coalesce(m.args ->> 'terms', 'are named') || ' to adopt'
      WHEN t.adopted IS NOT NULL THEN t.id || ' were adopted on ' || to_char(t.adopted, 'YYYY-MM-DD')
      WHEN a.decision IS NULL THEN m.decision || ' does not ask to adopt ' || t.id
    END AS r
    FROM decision.motion m
    LEFT JOIN patronage.terms t ON t.id = m.args ->> 'terms'
    LEFT JOIN decision_patronage.adoption a ON a.decision = m.decision AND a.terms = t.id
    WHERE m.decision = payload ->> 'decision' AND m.kind = 'patronage'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('decision:decision:propose', 'decision_patronage.asks(jsonb)', 'decision-patronage');

-- patronage:terms:adopt — the cited decision moved to adopt these terms.
-- That it closed and passed on its roll is circle-decision-membership's guard,
-- attached through decision.cites.
CREATE FUNCTION decision_patronage.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (SELECT FROM decision_patronage.adoption a WHERE a.terms = p.terms AND a.decision = d.id)
      THEN d.id || ' does not adopt ' || coalesce(p.terms, 'these terms')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'terms' AS terms) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:terms:adopt', 'decision_patronage.adopts(jsonb)', 'decision-patronage');
INSERT INTO decision.cites (op, owner) VALUES ('patronage:terms:adopt', 'decision-patronage');

GRANT USAGE ON SCHEMA decision_patronage TO cella_app, cella_guards;
GRANT SELECT, INSERT ON decision_patronage.approval, decision_patronage.adoption TO cella_app;
GRANT SELECT ON decision_patronage.approval, decision_patronage.adoption TO cella_guards;
