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

-- circle:circle:message has no handler, so no entry of it can be logged:
-- one that is folds by refusing, never by changing nothing.
CREATE FUNCTION circle.fold_message(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'circle: entry % is a message, which no handler writes, so no fold applies it', entry ->> 'n';
END
$$;

SELECT cella.lets_fold('circle:circle:create', 1, 'circle.fold_create(jsonb)', 'circle');
SELECT cella.lets_fold('circle:circle:message', 1, 'circle.fold_message(jsonb)', 'circle');
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
