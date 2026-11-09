-- How each action that writes core person's schema applies to the
-- state before it (architecture.md, "Folds"): its own, and those of the
-- feats that enter a person or enrol a device through it. Each
-- takes its ids and its day from the entry, and a personal value as its
-- commitment (`cella.commits`).

-- person:device:enrol: the device its entry names, enrolled on the
-- entry's day by the device that signed it, under the label it carries;
-- an entry enrolling none, a key enrolled already, folds none.
CREATE FUNCTION person.fold_enrol(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF nullif(p ->> 'enrolled', '') IS NOT NULL THEN
    INSERT INTO person.device (key, address, label, enrolled, enrolled_by)
    VALUES (decode(p ->> 'key', 'hex'), p ->> 'address', cella.commits('person.device.label', p ->> 'address', (entry ->> 'n')::bigint, p -> 'label'),
            (entry ->> 'date')::date, decode(p ->> 'by', 'hex'));
  END IF;
END
$$;

-- person:device:revoke: the device its entry names is revoked on the
-- entry's day; one revoked already, an entry naming no day, stays as it
-- was.
CREATE FUNCTION person.fold_revoke(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF nullif(p ->> 'revoked', '') IS NOT NULL THEN
    UPDATE person.device SET revoked = (entry ->> 'date')::date WHERE key = decode(p ->> 'key', 'hex') AND revoked IS NULL;
  END IF;
END
$$;

-- person:person:profile: each field its entry names takes the value it
-- commits to.
CREATE FUNCTION person.fold_profile(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  who text := p ->> 'person';
  n bigint := (entry ->> 'n')::bigint;
BEGIN
  UPDATE person.person SET
    name = CASE WHEN jsonb_exists(p -> 'fields', 'name') THEN cella.commits('person.person.name', who, n, p -> 'values' -> 'name') ELSE name END,
    email = CASE WHEN jsonb_exists(p -> 'fields', 'email') THEN cella.commits('person.person.email', who, n, p -> 'values' -> 'email') ELSE email END,
    phone = CASE WHEN jsonb_exists(p -> 'fields', 'phone') THEN cella.commits('person.person.phone', who, n, p -> 'values' -> 'phone') ELSE phone END
  WHERE address = who;
END
$$;

-- person:person:forget changes no row of its own: its erasure folds as
-- the notary carried it out (`cella.fold_erasures`).
CREATE FUNCTION person.fold_forget(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  NULL;
END
$$;

-- membership:member:invite and employment:worker:hire enter a person new
-- to the scope, whose entry then carries their name's commitment; one
-- the scope knew already is left as they were: an invitation carries it
-- as its `name`, a hire, whose `name` is the worker's, as `entered`.
CREATE FUNCTION person.fold_entering(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  who text := coalesce(p ->> 'member', p ->> 'worker');
  named jsonb := CASE WHEN entry ->> 'op' = 'membership:member:invite' THEN p -> 'name' ELSE p -> 'entered' END;
BEGIN
  IF named IS NOT NULL THEN
    INSERT INTO person.person (address, name)
    VALUES (who, cella.commits('person.person.name', who, (entry ->> 'n')::bigint, named));
  END IF;
END
$$;

-- membership:member:accept and employment:worker:hire enrol a first
-- device, by the key their entry carries and its label's commitment,
-- an acceptance's as its `device`, a hire's as its `label`, on the day,
-- enrolled by no device.
CREATE FUNCTION person.fold_enrolling(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  who text := coalesce(p ->> 'member', p ->> 'worker');
BEGIN
  INSERT INTO person.device (key, address, label, enrolled)
  VALUES (decode(p ->> 'key', 'hex'), who,
          cella.commits('person.device.label', who, (entry ->> 'n')::bigint, p -> CASE entry ->> 'op' WHEN 'membership:member:accept' THEN 'device' ELSE 'label' END),
          (entry ->> 'date')::date);
END
$$;

-- employment:worker:hire enters a person and enrols their first device.
CREATE FUNCTION person.fold_hire(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM person.fold_entering(entry);
  PERFORM person.fold_enrolling(entry);
END
$$;

-- contact:contact:add enters a person contact new to the scope, whose
-- entry then carries, as `entered`, the commitments to their name and
-- to the email and phone it gave; a company, or a person the scope knew
-- already, carries none and enters no one.
CREATE FUNCTION person.fold_contact(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  who text := p -> 'values' ->> 'person';
  n bigint := (entry ->> 'n')::bigint;
BEGIN
  IF p -> 'entered' IS NOT NULL THEN
    INSERT INTO person.person (address, name, email, phone)
    VALUES (who, cella.commits('person.person.name', who, n, p -> 'entered' -> 'name'),
            cella.commits('person.person.email', who, n, p -> 'entered' -> 'email'),
            cella.commits('person.person.phone', who, n, p -> 'entered' -> 'phone'));
  END IF;
END
$$;

SELECT cella.lets_fold('person:device:enrol', 1, 'person.fold_enrol(jsonb)', 'person');
SELECT cella.lets_fold('person:device:revoke', 1, 'person.fold_revoke(jsonb)', 'person');
SELECT cella.lets_fold('person:person:profile', 1, 'person.fold_profile(jsonb)', 'person');
SELECT cella.lets_fold('person:person:forget', 1, 'person.fold_forget(jsonb)', 'person');
SELECT cella.lets_fold('membership:member:invite', 1, 'person.fold_entering(jsonb)', 'person');
SELECT cella.lets_fold('membership:member:accept', 1, 'person.fold_enrolling(jsonb)', 'person');
SELECT cella.lets_fold('employment:worker:hire', 1, 'person.fold_hire(jsonb)', 'person');
SELECT cella.lets_fold('contact:contact:add', 1, 'person.fold_contact(jsonb)', 'person');
