-- What of a client is personal data: a person's name, contact details,
-- address and the notes kept on them, all of class `contact`, erased
-- when asked. A company's are registered the same way, so its writes
-- commit to them too, but only a person is erased. The id is the slug
-- invoices and projects name the client by.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('client', 'client', 'name', 'contact', 'id', 'client'),
  ('client', 'client', 'email', 'contact', 'id', 'client'),
  ('client', 'client', 'phone', 'contact', 'id', 'client'),
  ('client', 'client', 'address', 'contact', 'id', 'client'),
  ('client', 'client', 'note', 'contact', 'id', 'client');

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('client:client:erase', 'erase-personal-data', NULL, 'client');

-- client:client:erase — the write erased a person's contact data, and
-- that alone: a company's data is not personal and is never erased.
CREATE FUNCTION client.erases(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no client ' || coalesce(p.client, 'is named')
    WHEN c.kind <> 'person' THEN c.id || ' is a company: its data is not personal'
    WHEN p.subject IS DISTINCT FROM c.id OR p.erased IS DISTINCT FROM '["contact"]'::jsonb
      THEN 'the erasure is not of ' || c.id || '''s contact data'
  END
  FROM (
    SELECT payload ->> 'client' AS client,
           payload -> 'erasure' -> '$erasure' ->> 'subject' AS subject,
           payload -> 'erasure' -> '$erasure' -> 'erased' AS erased
  ) p
  LEFT JOIN client.client c ON c.id = p.client;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('client:client:erase', 'client.erases(jsonb)', 'client');
