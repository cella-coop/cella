CREATE SCHEMA motion;

CREATE TABLE motion.motion (
  id text PRIMARY KEY,
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  -- The grantee it is proposed as: its circle, or a role its proposer
  -- holds on the day.
  author text NOT NULL REFERENCES circle.grantee,
  -- The person who proposed it, its entry's actor, whose words its title
  -- and its text are (`008-ballot.sql`).
  proposer text NOT NULL,
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

-- A motion proposed as no one named is its circle's, and its author is
-- fixed.
CREATE FUNCTION motion.authored_by() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author := coalesce(NEW.author, NEW.circle);
  ELSIF NEW.author IS DISTINCT FROM OLD.author THEN
    RAISE EXCEPTION '% was proposed as %, and its author is fixed', OLD.id, OLD.author
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER authored_by BEFORE INSERT OR UPDATE ON motion.motion
  FOR EACH ROW EXECUTE FUNCTION motion.authored_by();

-- A stance, ordered by its receipt; `at` is the day the member gives and
-- orders nothing.
CREATE TABLE motion.vote (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
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

-- motion:motion:propose — the motion's author is the one its payload
-- names, and is its own circle or a role its proposer holds by a tenure
-- on the verdict date. The reason names the role and the day, never the
-- proposer.
CREATE FUNCTION motion.authored(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no motion ' || coalesce(p.motion, 'is named')
    WHEN d.author IS DISTINCT FROM p.author
      THEN d.id || ' is proposed as ' || d.author || ', not as ' || coalesce(p.author, 'no one') || ' as its payload names'
    WHEN d.author = d.circle THEN NULL
    WHEN g.kind = 'circle'
      THEN 'a motion of ' || d.circle || ' is proposed as ' || d.circle || ' or as a role its proposer holds, not as ' || d.author || ', another circle'
    WHEN NOT EXISTS (
      SELECT FROM circle.tenure t
      WHERE t.role = d.author AND t.holder = cella.actor()
        AND (t.since IS NULL OR t.since <= cella.verdict_date())
        AND (t.until IS NULL OR t.until > cella.verdict_date())
    ) THEN 'the ' || d.author || ' role is held by no tenure of the proposer''s on '
      || to_char(cella.verdict_date(), 'YYYY-MM-DD') || ': propose as ' || d.circle || ', or as a role held that day'
  END
  FROM (SELECT payload ->> 'motion' AS motion, payload ->> 'author' AS author) p
  LEFT JOIN motion.motion d ON d.id = p.motion
  LEFT JOIN circle.grantee g ON g.id = d.author;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('motion:motion:propose', 'motion.authored(jsonb)', 'motion');

GRANT USAGE ON SCHEMA motion TO cella_app;
GRANT SELECT, INSERT, UPDATE ON motion.motion TO cella_app;
GRANT SELECT, INSERT ON motion.vote TO cella_app;
