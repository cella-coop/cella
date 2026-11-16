-- How each action that writes core's circles applies to the state before
-- it (architecture.md, "Folds"): a function of the entry alone, which
-- writes only this schema, takes its ids and its day from the entry, and
-- where it runs the same SQL as its handler, refuses a result that is not
-- what the entry says.

-- circle:circle:create: the circle, by the id, name and purpose its entry
-- carries; the default bundle it names is the one in force that day.
CREATE FUNCTION circle.fold_create(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  bundle bigint[];
BEGIN
  INSERT INTO circle.circle (id, name, purpose) VALUES (p ->> 'circle', p ->> 'name', p ->> 'purpose');
  bundle := circle.bundle((entry ->> 'date')::date);
  IF bundle IS DISTINCT FROM ARRAY(SELECT b::bigint FROM jsonb_array_elements_text(p -> 'bundle') b) THEN
    RAISE EXCEPTION 'circle: entry % names the bundle %, where the mandates folded give %', entry ->> 'n', p -> 'bundle', bundle;
  END IF;
END
$$;

-- circle:circle:amend: the circle its entry names, its name, purpose or
-- procedure changed to the values it carries, each from what the entry
-- says it was.
CREATE FUNCTION circle.fold_amend(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  was jsonb;
BEGIN
  SELECT jsonb_build_object('name', c.name, 'purpose', c.purpose, 'procedure', c.procedure) INTO was
  FROM circle.circle c WHERE c.id = p ->> 'circle';
  IF was IS NULL THEN
    RAISE EXCEPTION 'circle: entry % amends %, which the fold has no circle of', entry ->> 'n', p ->> 'circle';
  END IF;
  IF EXISTS (SELECT FROM jsonb_each(p -> 'was') w WHERE was -> w.key IS DISTINCT FROM w.value) THEN
    RAISE EXCEPTION 'circle: entry % says % was %, where the fold has %', entry ->> 'n', p ->> 'circle', p -> 'was', was;
  END IF;
  UPDATE circle.circle
  SET name = coalesce(p ->> 'name', name), purpose = coalesce(p ->> 'purpose', purpose), procedure = coalesce(p ->> 'procedure', procedure)
  WHERE id = p ->> 'circle';
END
$$;

-- circle:circle:arrange and circle:feature:arrange: the circle its entry
-- names, its features replaced by the listing it carries, from what the
-- entry says they were, as `circle.features` spells them
-- (`012-features.sql`): a motion's arrangement and a holder's own fold
-- the same.
CREATE FUNCTION circle.fold_arrange(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  was text;
BEGIN
  SELECT circle.features(c.id) INTO was FROM circle.circle c WHERE c.id = p ->> 'circle';
  IF was IS NULL THEN
    RAISE EXCEPTION 'circle: entry % arranges %, which the fold has no circle of', entry ->> 'n', p ->> 'circle';
  END IF;
  IF was IS DISTINCT FROM p ->> 'was' THEN
    RAISE EXCEPTION 'circle: entry % says the features of % were %, where the fold has %', entry ->> 'n', p ->> 'circle', p ->> 'was', was;
  END IF;
  DELETE FROM circle.feature WHERE circle = p ->> 'circle';
  INSERT INTO circle.feature (circle, feat, position, "group")
  SELECT p ->> 'circle', l.feat, l.position, l."group" FROM circle.listed(p ->> 'features') l
  ON CONFLICT DO NOTHING;
END
$$;

-- circle:role:make: the role its entry names, in its circle, with its
-- name, duty and cap, none uncapped.
CREATE FUNCTION circle.fold_role_make(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO circle.role (id, circle, name, duty, holders)
  VALUES (p ->> 'role', p ->> 'circle', p ->> 'name', coalesce(p ->> 'duty', ''), (p ->> 'holders')::int);
END
$$;

-- circle:role:amend: the role its entry names, its name, duty or cap
-- changed to the values it carries, each from what the entry says it was,
-- a cap carried as none lifting it.
CREATE FUNCTION circle.fold_role_amend(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  was jsonb;
BEGIN
  SELECT jsonb_build_object('name', r.name, 'duty', r.duty, 'holders', r.holders) INTO was
  FROM circle.role r WHERE r.id = p ->> 'role';
  IF was IS NULL THEN
    RAISE EXCEPTION 'circle: entry % amends the % role, which the fold has none of', entry ->> 'n', p ->> 'role';
  END IF;
  IF EXISTS (SELECT FROM jsonb_each(p -> 'was') w WHERE was -> w.key IS DISTINCT FROM w.value) THEN
    RAISE EXCEPTION 'circle: entry % says the % role was %, where the fold has %', entry ->> 'n', p ->> 'role', p -> 'was', was;
  END IF;
  UPDATE circle.role
  SET name = coalesce(p ->> 'name', name), duty = coalesce(p ->> 'duty', duty),
      holders = CASE WHEN p ? 'holders' THEN (p ->> 'holders')::int ELSE holders END
  WHERE id = p ->> 'role';
END
$$;

-- circle:seat:add: the seat its entry names, by its id, from the entry's
-- day: a tenure of the role it names, or a membership of the circle where
-- it names none.
CREATE FUNCTION circle.fold_seat_add(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF nullif(p ->> 'role', '') IS NULL THEN
    INSERT INTO circle.member (id, circle, person, since)
    VALUES ((p ->> 'seat')::bigint, p ->> 'circle', p ->> 'member', (entry ->> 'date')::date);
  ELSE
    INSERT INTO circle.tenure (id, circle, holder, role, since)
    VALUES ((p ->> 'seat')::bigint, p ->> 'circle', p ->> 'member', p ->> 'role', (entry ->> 'date')::date);
  END IF;
END
$$;

-- circle:seat:remove: the seat its entry names ends on the entry's day; an
-- entry naming no seat, 0, ended none.
CREATE FUNCTION circle.fold_seat_remove(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF nullif(p ->> 'role', '') IS NULL THEN
    UPDATE circle.member SET until = (entry ->> 'date')::date WHERE id = (p ->> 'seat')::bigint;
  ELSE
    UPDATE circle.tenure SET until = (entry ->> 'date')::date WHERE id = (p ->> 'seat')::bigint;
  END IF;
END
$$;

-- circle:role:seat: the membership of the circle whose member is the role,
-- by the seat id, circle and role its entry carries, from the entry's day.
CREATE FUNCTION circle.fold_role_seat(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO circle.member (id, circle, role, since)
  VALUES ((p ->> 'seat')::bigint, p ->> 'circle', p ->> 'role', (entry ->> 'date')::date);
END
$$;

-- circle:role:unseat: the membership its entry names ends on the entry's
-- day; an entry naming no seat, 0, ended none.
CREATE FUNCTION circle.fold_role_unseat(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  UPDATE circle.member SET until = (entry ->> 'date')::date WHERE id = (p ->> 'seat')::bigint;
END
$$;

SELECT cella.lets_fold('circle:circle:create', 1, 'circle.fold_create(jsonb)', 'circle');
SELECT cella.lets_fold('circle:circle:amend', 1, 'circle.fold_amend(jsonb)', 'circle');
SELECT cella.lets_fold('circle:circle:arrange', 1, 'circle.fold_arrange(jsonb)', 'circle');
SELECT cella.lets_fold('circle:feature:arrange', 1, 'circle.fold_arrange(jsonb)', 'circle');
SELECT cella.lets_fold('circle:role:make', 1, 'circle.fold_role_make(jsonb)', 'circle');
SELECT cella.lets_fold('circle:role:amend', 1, 'circle.fold_role_amend(jsonb)', 'circle');
SELECT cella.lets_fold('circle:seat:add', 1, 'circle.fold_seat_add(jsonb)', 'circle');
SELECT cella.lets_fold('circle:seat:remove', 1, 'circle.fold_seat_remove(jsonb)', 'circle');
SELECT cella.lets_fold('circle:role:seat', 1, 'circle.fold_role_seat(jsonb)', 'circle');
SELECT cella.lets_fold('circle:role:unseat', 1, 'circle.fold_role_unseat(jsonb)', 'circle');

-- membership:member:admit, as a carried motion admits: the member seated
-- in the motion's circle as a member, by the seat id, circle and day its
-- entry carries; an admission by no motion seats no one.
CREATE FUNCTION circle.fold_admitting(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF (p ->> 'seat') IS NOT NULL THEN
    INSERT INTO circle.tenure (id, circle, holder, role, since)
    VALUES ((p ->> 'seat')::bigint, p ->> 'circle', p ->> 'member', 'member', (entry ->> 'date')::date);
  END IF;
END
$$;

SELECT cella.lets_fold('membership:member:admit', 1, 'circle.fold_admitting(jsonb)', 'circle');
