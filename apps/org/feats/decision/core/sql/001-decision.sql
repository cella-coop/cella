CREATE SCHEMA decision;

CREATE TABLE decision.decision (
  id text PRIMARY KEY,
  circle text NOT NULL,
  title text NOT NULL,
  rule text NOT NULL CHECK (rule IN ('consent', 'majority')),
  proposed date NOT NULL,
  deadline date NOT NULL,
  body text NOT NULL DEFAULT '',
  closed date,
  -- The receipt the close took: only stances received before it count.
  cutoff bigint,
  CHECK ((closed IS NULL) = (cutoff IS NULL))
);

-- A stance, ordered by its receipt; `at` is the day the member gives and
-- orders nothing.
CREATE TABLE decision.vote (
  receipt bigint PRIMARY KEY,
  decision text NOT NULL REFERENCES decision.decision,
  member text NOT NULL,
  stance text NOT NULL CHECK (stance IN ('for', 'against', 'abstain', 'consent', 'object')),
  at date NOT NULL
);

CREATE INDEX ON decision.vote (decision);

-- A closed decision stays closed, and takes no more stances.
CREATE FUNCTION decision.stays_closed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.closed IS NOT NULL THEN
    RAISE EXCEPTION '% closed on %', OLD.id, OLD.closed
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_closed BEFORE UPDATE ON decision.decision
  FOR EACH ROW EXECUTE FUNCTION decision.stays_closed();

CREATE FUNCTION decision.open_for_votes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM decision.decision d WHERE d.id = NEW.decision AND d.closed IS NOT NULL) THEN
    RAISE EXCEPTION '% is closed', NEW.decision
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER open_for_votes BEFORE INSERT ON decision.vote
  FOR EACH ROW EXECUTE FUNCTION decision.open_for_votes();

-- decision:decision:close — the write closed the decision on the verdict
-- date, and not before its deadline.
CREATE FUNCTION decision.closes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || p.id
    WHEN d.closed IS DISTINCT FROM cella.verdict_date() THEN d.id || ' was not closed by this write'
    WHEN d.closed < d.deadline THEN d.id || ' is open until ' || to_char(d.deadline, 'YYYY-MM-DD')
  END
  FROM (SELECT payload ->> 'decision' AS id) p
  LEFT JOIN decision.decision d ON d.id = p.id;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('decision:decision:close', 'decision.closes(jsonb)', 'decision');

GRANT USAGE ON SCHEMA decision TO cella_app;
GRANT SELECT, INSERT, UPDATE ON decision.decision TO cella_app;
GRANT SELECT, INSERT ON decision.vote TO cella_app;
