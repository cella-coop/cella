-- One sequence for members and tenures, so a seat's id names one row of
-- either.
CREATE SEQUENCE circle.seat_id;

-- A member of a circle: a person, by address, or a role, by id, with no
-- foreign key into either feat. A role that is a member seats whoever
-- holds it (the double link); a `*` role, its holder of every circle. One
-- with no `since` was held before the records began; one that ends keeps
-- its row, with `until`, so who sat where on a past day can be read back.
CREATE TABLE circle.member (
  id bigint PRIMARY KEY DEFAULT nextval('circle.seat_id'),
  circle text NOT NULL,
  person text,
  role text,
  since date,
  until date,
  CHECK (num_nonnulls(person, role) = 1),
  CHECK (until IS NULL OR since IS NULL OR since < until)
);

CREATE INDEX ON circle.member (circle);
CREATE INDEX ON circle.member (person);
CREATE INDEX ON circle.member (role);

-- A person's time in a role: its `circle` is the role's own, or for a `*`
-- role the working circle it is held in.
CREATE TABLE circle.tenure (
  id bigint PRIMARY KEY DEFAULT nextval('circle.seat_id'),
  holder text NOT NULL,
  role text NOT NULL,
  circle text NOT NULL,
  since date,
  until date,
  CHECK (until IS NULL OR since IS NULL OR since < until)
);

CREATE INDEX ON circle.tenure (holder);
CREATE INDEX ON circle.tenure (role, circle);

-- A tenure is of a role in its own circle, and makes no more holders of
-- it in the circle at once than its `holders`: the tenures it overlaps,
-- itself among them, are within the cap. A handover ends one tenure on
-- the day the next begins, so the two never overlap.
CREATE FUNCTION circle.capped() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r circle.role;
  held int;
BEGIN
  SELECT * INTO r FROM circle.role WHERE id = NEW.role;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'no role %', NEW.role USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF r.circle <> '*' AND r.circle <> NEW.circle THEN
    RAISE EXCEPTION 'the % role is % circle''s, not %''s', NEW.role, r.circle, NEW.circle
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF r.holders IS NOT NULL THEN
    SELECT count(*) INTO held FROM circle.tenure t
    WHERE t.role = NEW.role AND t.circle = NEW.circle AND t.id <> NEW.id
      AND (t.since IS NULL OR NEW.until IS NULL OR t.since < NEW.until)
      AND (t.until IS NULL OR NEW.since IS NULL OR t.until > NEW.since);
    IF held >= r.holders THEN
      RAISE EXCEPTION 'the % role is held by % at most in %, and % holds it then', NEW.role, r.holders, NEW.circle,
        (SELECT string_agg(t.holder, ', ') FROM circle.tenure t
         WHERE t.role = NEW.role AND t.circle = NEW.circle AND t.id <> NEW.id
           AND (t.since IS NULL OR NEW.until IS NULL OR t.since < NEW.until)
           AND (t.until IS NULL OR NEW.since IS NULL OR t.until > NEW.since))
        USING ERRCODE = 'triggered_action_exception';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER capped BEFORE INSERT OR UPDATE ON circle.tenure
  FOR EACH ROW EXECUTE FUNCTION circle.capped();

-- Where each person sits, read from the members and the tenures and
-- never stored: as a member of the circle, with no role; by a tenure, in
-- its circle with its role; and by a tenure of a role that is a member of
-- a circle, there with no role, for the days the two overlap, so the
-- role's mandates reach no further than they do. That last row has no id.
CREATE VIEW circle.seat AS
SELECT m.id, m.circle, m.person AS member, NULL::text AS role, m.since, m.until
FROM circle.member m
WHERE m.person IS NOT NULL
UNION ALL
SELECT t.id, t.circle, t.holder, t.role, t.since, t.until
FROM circle.tenure t
UNION ALL
SELECT NULL::bigint, m.circle, t.holder, NULL::text,
  CASE WHEN m.since IS NULL THEN t.since WHEN t.since IS NULL THEN m.since ELSE greatest(m.since, t.since) END,
  CASE WHEN m.until IS NULL THEN t.until WHEN t.until IS NULL THEN m.until ELSE least(m.until, t.until) END
FROM circle.member m
JOIN circle.tenure t ON t.role = m.role
WHERE (m.since IS NULL OR t.until IS NULL OR m.since < t.until)
  AND (m.until IS NULL OR t.since IS NULL OR m.until > t.since);

-- The members seated in a circle on a day.
CREATE FUNCTION circle.seated(circle text, day date) RETURNS SETOF text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT DISTINCT p.member
  FROM circle.seat p
  WHERE p.circle = seated.circle
    AND (p.since IS NULL OR p.since <= seated.day)
    AND (p.until IS NULL OR p.until > seated.day);
END;

GRANT SELECT ON circle.member, circle.tenure, circle.seat TO cella_app, cella_guards;
GRANT USAGE ON SEQUENCE circle.seat_id TO cella_app;

-- A member or a tenure is added by `circle:seat:add`, from the verdict
-- date, and ends by `circle:seat:remove`, on the verdict date; it keeps
-- its row, so who sat where reads back. Both writes are decided: the
-- membership-motion graft, which joins the motion, judges them.
GRANT INSERT ON circle.member, circle.tenure TO cella_app;
GRANT UPDATE (until) ON circle.member, circle.tenure TO cella_app;
