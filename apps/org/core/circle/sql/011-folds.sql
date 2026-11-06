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

-- circle:circle:message has no handler, so no entry of it can be logged:
-- one that is folds by refusing, never by changing nothing.
CREATE FUNCTION circle.fold_message(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'circle: entry % is a message, which no handler writes, so no fold applies it', entry ->> 'n';
END
$$;

-- The mandate, the right or the disclosure values its entry's policy
-- grants or revokes, by the SQL its handler runs, `circle.mandate_from`
-- or `circle.mandate_ended`, on the policy register as the entry's own
-- slice folded it, with the mandate's id the entry's; a mandate or a
-- revocation other than the entry's refuses.
CREATE FUNCTION circle.folded_grant(entry jsonb, made bigint, gone bigint[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  said bigint[] := ARRAY(SELECT r::bigint FROM jsonb_array_elements_text(coalesce(p -> 'revoked', '[]')) r);
BEGIN
  IF made IS DISTINCT FROM (p ->> 'mandate')::bigint OR coalesce(gone, '{}') <> said THEN
    RAISE EXCEPTION 'circle: entry % says mandate % revoking %, where the fold gives mandate % revoking %',
      entry ->> 'n', coalesce(p ->> 'mandate', 'none'), said, coalesce(made::text, 'none'), coalesce(gone, '{}');
  END IF;
END
$$;

CREATE FUNCTION circle.fold_granting(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  r record;
BEGIN
  IF nullif(p ->> 'policy', '') IS NULL THEN
    RETURN;
  END IF;
  IF p ->> 'mandate' IS NOT NULL THEN
    PERFORM setval(pg_get_serial_sequence('circle.mandate', 'id'), (p ->> 'mandate')::bigint, false);
  END IF;
  SELECT * INTO r FROM circle.mandate_from(p ->> 'policy');
  PERFORM circle.folded_grant(entry, r.mandate, r.revoked);
END
$$;

CREATE FUNCTION circle.fold_revoking(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  r record;
BEGIN
  IF nullif(p ->> 'policy', '') IS NULL THEN
    RETURN;
  END IF;
  SELECT * INTO r FROM circle.mandate_ended(p ->> 'policy');
  PERFORM circle.folded_grant(entry, r.mandate, r.revoked);
END
$$;

SELECT cella.lets_fold('circle:circle:create', 1, 'circle.fold_create(jsonb)', 'circle');
SELECT cella.lets_fold('circle:circle:message', 1, 'circle.fold_message(jsonb)', 'circle');
SELECT cella.lets_fold('circle:seat:add', 1, 'circle.fold_seat_add(jsonb)', 'circle');
SELECT cella.lets_fold('circle:seat:remove', 1, 'circle.fold_seat_remove(jsonb)', 'circle');
SELECT cella.lets_fold('motion:policy:adopt', 1, 'circle.fold_granting(jsonb)', 'circle');
SELECT cella.lets_fold('motion:policy:end', 1, 'circle.fold_revoking(jsonb)', 'circle');
