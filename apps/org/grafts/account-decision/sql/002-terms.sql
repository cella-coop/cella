-- What a decision may decide of the work share's terms, registered with
-- the decision feat so its New form offers it: adopting drafted terms,
-- picked from those this graft adds to the form (`options`).
INSERT INTO decision.kind (kind, label, fields, owner) VALUES
  ('terms', 'Adopt the work share''s terms', '[{"name": "terms", "label": "Terms", "type": "text", "options": "terms"}]', 'account-decision');

-- The decision of the members that adopts terms, as its motion names
-- them. Both sides are referenced by id, with no foreign key into either
-- feat.
CREATE TABLE account_decision.adoption (
  terms text NOT NULL,
  decision text NOT NULL,
  PRIMARY KEY (terms, decision)
);

-- A motion to adopt terms names terms that exist and are not adopted
-- yet, whatever wrote it; the adoption it asks for is recorded with it.
CREATE FUNCTION account_decision.moved() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind <> 'terms' THEN
    RETURN NEW;
  END IF;
  INSERT INTO account_decision.adoption (terms, decision)
  SELECT t.id, NEW.decision FROM account.terms t WHERE t.id = NEW.args ->> 'terms' AND t.adopted IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no terms % to adopt', coalesce(NEW.args ->> 'terms', 'are named')
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER adopts_terms AFTER INSERT ON decision.motion
  FOR EACH ROW EXECUTE FUNCTION account_decision.moved();

-- decision:decision:propose — each motion to adopt terms names terms not
-- yet adopted, and the decision asks to adopt them.
CREATE FUNCTION account_decision.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN t.id IS NULL THEN 'no terms ' || coalesce(m.args ->> 'terms', 'are named') || ' to adopt'
      WHEN t.adopted IS NOT NULL THEN t.id || ' were adopted on ' || to_char(t.adopted, 'YYYY-MM-DD')
      WHEN a.decision IS NULL THEN m.decision || ' does not ask to adopt ' || t.id
    END AS r
    FROM decision.motion m
    LEFT JOIN account.terms t ON t.id = m.args ->> 'terms'
    LEFT JOIN account_decision.adoption a ON a.decision = m.decision AND a.terms = t.id
    WHERE m.decision = payload ->> 'decision' AND m.kind = 'terms'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('decision:decision:propose', 'account_decision.asks(jsonb)', 'account-decision');

-- account:terms:adopt — the cited decision moved to adopt these terms.
-- That it closed and passed on its roll is circle-decision-member's rule,
-- attached through decision.cites.
CREATE FUNCTION account_decision.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (SELECT FROM account_decision.adoption a WHERE a.terms = p.terms AND a.decision = d.id)
      THEN d.id || ' does not adopt ' || coalesce(p.terms, 'these terms')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'terms' AS terms) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('account:terms:adopt', 'account_decision.adopts(jsonb)', 'account-decision');
INSERT INTO decision.cites (op, owner) VALUES ('account:terms:adopt', 'account-decision');

GRANT SELECT, INSERT ON account_decision.adoption TO cella_app;
GRANT SELECT ON account_decision.adoption TO cella_rules;
