-- What of a contact is personal data: a person's name, contact details,
-- address and the notes kept on them, all of class `contact`, erased
-- when asked. A company's are registered the same way, so its writes
-- commit to them too, but only a person is erased. The id is the slug
-- invoices and projects name the contact by.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('contact', 'contact', 'name', 'contact', 'id', 'contact'),
  ('contact', 'contact', 'email', 'contact', 'id', 'contact'),
  ('contact', 'contact', 'phone', 'contact', 'id', 'contact'),
  ('contact', 'contact', 'address', 'contact', 'id', 'contact'),
  ('contact', 'contact', 'note', 'contact', 'id', 'contact');

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('contact:contact:erase', 'erase-personal-data', NULL, 'contact');

-- contact:contact:erase — the write erased a person's contact data, and
-- that alone: a company's data is not personal and is never erased.
CREATE FUNCTION contact.erases(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no contact ' || coalesce(p.contact, 'is named')
    WHEN c.kind <> 'person' THEN c.id || ' is a company: its data is not personal'
    WHEN p.subject IS DISTINCT FROM c.id OR p.erased IS DISTINCT FROM '["contact"]'::jsonb
      THEN 'the erasure is not of ' || c.id || '''s contact data'
  END
  FROM (
    SELECT payload ->> 'contact' AS contact,
           payload -> 'erasure' -> '$erasure' ->> 'subject' AS subject,
           payload -> 'erasure' -> '$erasure' -> 'erased' AS erased
  ) p
  LEFT JOIN contact.contact c ON c.id = p.contact;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('contact:contact:erase', 'contact.erases(jsonb)', 'contact');
