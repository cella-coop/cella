CREATE SCHEMA motion;

CREATE TABLE motion.motion (
  id text PRIMARY KEY,
  circle text NOT NULL,
  title text NOT NULL,
  method text NOT NULL CHECK (method IN ('consent', 'majority')),
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
CREATE TABLE motion.vote (
  receipt bigint PRIMARY KEY,
  motion text NOT NULL REFERENCES motion.motion,
  member text NOT NULL,
  stance text NOT NULL CHECK (stance IN ('for', 'against', 'abstain', 'consent', 'object')),
  at date NOT NULL
);

CREATE INDEX ON motion.vote (motion);

-- A closed motion stays closed, and takes no more stances.
CREATE FUNCTION motion.stays_closed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.closed IS NOT NULL THEN
    RAISE EXCEPTION '% closed on %', OLD.id, OLD.closed
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_closed BEFORE UPDATE ON motion.motion
  FOR EACH ROW EXECUTE FUNCTION motion.stays_closed();

CREATE FUNCTION motion.open_for_votes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM motion.motion d WHERE d.id = NEW.motion AND d.closed IS NOT NULL) THEN
    RAISE EXCEPTION '% is closed', NEW.motion
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER open_for_votes BEFORE INSERT ON motion.vote
  FOR EACH ROW EXECUTE FUNCTION motion.open_for_votes();

-- motion:motion:close — the write closed the motion on the verdict
-- date, and not before its deadline.
CREATE FUNCTION motion.closes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || p.id
    WHEN d.closed IS DISTINCT FROM cella.verdict_date() THEN d.id || ' was not closed by this write'
    WHEN d.closed < d.deadline THEN d.id || ' is open until ' || to_char(d.deadline, 'YYYY-MM-DD')
  END
  FROM (SELECT payload ->> 'motion' AS id) p
  LEFT JOIN motion.motion d ON d.id = p.id;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:close', 'motion.closes(jsonb)', 'motion');

GRANT USAGE ON SCHEMA motion TO cella_app;
GRANT SELECT, INSERT, UPDATE ON motion.motion TO cella_app;
GRANT SELECT, INSERT ON motion.vote TO cella_app;
