CREATE SCHEMA account_motion;

-- What a motion may decide of the statutes' capital clauses, registered
-- with the motion feat so its New form offers it: adopting drafted
-- terms, picked from those this graft adds to the form (`options`).
INSERT INTO motion.carries (kind, label, fields, owner) VALUES
  ('terms', 'Adopt the capital''s terms', '[{"name": "terms", "label": "Terms", "type": "text", "options": "terms"}]', 'account-motion');

-- The motion of the members that adopts terms, as its action names
-- them. Both sides are referenced by id, with no foreign key into either
-- feat.
CREATE TABLE account_motion.adoption (
  terms text NOT NULL,
  motion text NOT NULL,
  PRIMARY KEY (terms, motion)
);

-- An action to adopt terms names terms that exist and are not adopted
-- yet, whatever wrote it; the adoption it asks for is recorded with it.
CREATE FUNCTION account_motion.moved() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind <> 'terms' THEN
    RETURN NEW;
  END IF;
  INSERT INTO account_motion.adoption (terms, motion)
  SELECT t.id, NEW.motion FROM account.terms t WHERE t.id = NEW.args ->> 'terms' AND t.adopted IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no terms % to adopt', coalesce(NEW.args ->> 'terms', 'are named')
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER adopts_terms AFTER INSERT ON motion.action
  FOR EACH ROW EXECUTE FUNCTION account_motion.moved();

-- motion:motion:propose — each action to adopt terms names terms not
-- yet adopted, and the motion asks to adopt them.
CREATE FUNCTION account_motion.asks(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r FROM (
    SELECT CASE
      WHEN t.id IS NULL THEN 'no terms ' || coalesce(m.args ->> 'terms', 'are named') || ' to adopt'
      WHEN t.adopted IS NOT NULL THEN t.id || ' were adopted on ' || to_char(t.adopted, 'YYYY-MM-DD')
      WHEN a.motion IS NULL THEN m.motion || ' does not ask to adopt ' || t.id
    END AS r
    FROM motion.action m
    LEFT JOIN account.terms t ON t.id = m.args ->> 'terms'
    LEFT JOIN account_motion.adoption a ON a.motion = m.motion AND a.terms = t.id
    WHERE m.motion = payload ->> 'motion' AND m.kind = 'terms'
  ) x
  WHERE r IS NOT NULL
  LIMIT 1;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:propose', 'account_motion.asks(jsonb)', 'account-motion');

-- account:terms:adopt — the cited motion moved to adopt these terms.
-- That it closed and passed on its roll is circle-membership-motion's guard,
-- attached through motion.cites.
CREATE FUNCTION account_motion.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is cited')
    WHEN NOT EXISTS (SELECT FROM account_motion.adoption a WHERE a.terms = p.terms AND a.motion = d.id)
      THEN d.id || ' does not adopt ' || coalesce(p.terms, 'these terms')
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'terms' AS terms) p
  LEFT JOIN motion.motion d ON d.id = p.motion;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('account:terms:adopt', 'account_motion.adopts(jsonb)', 'account-motion');
INSERT INTO motion.cites (op, owner) VALUES ('account:terms:adopt', 'account-motion');

GRANT USAGE ON SCHEMA account_motion TO cella_app, cella_guards;
GRANT SELECT, INSERT ON account_motion.adoption TO cella_app;
GRANT SELECT ON account_motion.adoption TO cella_guards;
