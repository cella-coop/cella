-- How each action that writes the contact feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- What `set` wrote, in the write of entry `n`: each field the entry names
-- of the contact `id`, at the value it keeps, a personal one as its
-- commitment, written `redacted`, as JSON where its column is; a field it
-- does not name stays as it was.
CREATE FUNCTION contact.fold_set(n bigint, id text, fields jsonb, vals jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE contact.contact c SET
    kind = CASE WHEN fields ? 'kind' THEN vals ->> 'kind' ELSE c.kind END,
    person = CASE WHEN fields ? 'person' THEN vals ->> 'person' ELSE c.person END,
    name = CASE WHEN fields ? 'name' THEN cella.commits('contact.contact.name', c.id, n, vals -> 'name') ELSE c.name END,
    form = CASE WHEN fields ? 'form' THEN vals ->> 'form' ELSE c.form END,
    email = CASE WHEN fields ? 'email' THEN cella.commits('contact.contact.email', c.id, n, vals -> 'email') ELSE c.email END,
    phone = CASE WHEN fields ? 'phone' THEN cella.commits('contact.contact.phone', c.id, n, vals -> 'phone') ELSE c.phone END,
    address = CASE WHEN fields ? 'address' THEN to_jsonb(cella.commits('contact.contact.address', c.id, n, vals -> 'address')) ELSE c.address END,
    parent = CASE WHEN fields ? 'parent' THEN vals ->> 'parent' ELSE c.parent END,
    tags = CASE WHEN fields ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(vals -> 'tags')) ELSE c.tags END,
    note = CASE WHEN fields ? 'note' THEN cella.commits('contact.contact.note', c.id, n, vals -> 'note') ELSE c.note END,
    client = CASE WHEN fields ? 'client' THEN vals ->> 'client' ELSE c.client END,
    archived = CASE WHEN fields ? 'archived' THEN (vals ->> 'archived')::boolean ELSE c.archived END
  WHERE c.id = fold_set.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact: entry % sets the fields of %, which the contacts do not hold', n, id;
  END IF;
END
$$;

-- contact:contact:add: the contact under the id the entry names, with
-- the fields it names: a company's name among them, or a person's
-- address, whom core person's fold enters after it where the entry
-- brought them in.
CREATE FUNCTION contact.fold_add(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  n bigint := (entry ->> 'n')::bigint;
BEGIN
  INSERT INTO contact.contact (id, kind, person, name)
  VALUES (p ->> 'contact', coalesce(p -> 'values' ->> 'kind', 'company'), p -> 'values' ->> 'person',
          cella.commits('contact.contact.name', p ->> 'contact', n, p -> 'values' -> 'name'));
  PERFORM contact.fold_set(n, p ->> 'contact', p -> 'fields', p -> 'values');
END
$$;

-- contact:contact:update and contact:contact:archive: the fields the
-- entry names, an archive's `archived` alone.
CREATE FUNCTION contact.fold_update(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT contact.fold_set((fold_update.entry ->> 'n')::bigint, fold_update.entry -> 'payload' ->> 'contact',
                          fold_update.entry -> 'payload' -> 'fields', fold_update.entry -> 'payload' -> 'values');
END;

-- contact:contact:erase: the person, archived; their contact data, the
-- contact's and their core person's, is erased by the erasures the
-- entry keeps, which `cella.fold_log` folds
-- after this fold, as the notary carried it out once the write's state was
-- in.
CREATE FUNCTION contact.fold_erase(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE contact.contact SET archived = true WHERE id = entry -> 'payload' ->> 'contact';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact: entry % erases %, which the contacts do not hold', entry ->> 'n', entry -> 'payload' ->> 'contact';
  END IF;
END
$$;

SELECT cella.lets_fold('contact:contact:add', 1, 'contact.fold_add(jsonb)', 'contact');
SELECT cella.lets_fold('contact:contact:update', 1, 'contact.fold_update(jsonb)', 'contact');
SELECT cella.lets_fold('contact:contact:archive', 1, 'contact.fold_update(jsonb)', 'contact');
SELECT cella.lets_fold('contact:contact:erase', 1, 'contact.fold_erase(jsonb)', 'contact');
