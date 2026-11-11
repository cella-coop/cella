-- What of a contact is personal data: a company's name and contact
-- details, and every contact's address and the notes kept on them, all
-- of class `contact`, erased when asked. A person contact's name, email
-- and phone are core person's, registered there by their address. A
-- company's are registered so its writes commit to them too, but only a
-- person is erased. The id is the slug invoices and projects name the
-- contact by.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('contact', 'contact', 'name', 'contact', 'id', 'contact'),
  ('contact', 'contact', 'email', 'contact', 'id', 'contact'),
  ('contact', 'contact', 'phone', 'contact', 'id', 'contact'),
  ('contact', 'contact', 'address', 'contact', 'id', 'contact'),
  ('contact', 'contact', 'note', 'contact', 'id', 'contact');

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('contact:contact:erase', 'erase-personal-data', NULL, 'contact');

-- contact:contact:erase — the write erased a person's contact data, the
-- contact's own and their core person's contact details, and that alone:
-- a company's data is not personal and is never erased.
CREATE FUNCTION contact.erases(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no contact ' || coalesce(p.contact, 'is named')
    WHEN c.kind <> 'person' THEN c.id || ' is a company: its data is not personal'
    WHEN p.subject IS DISTINCT FROM c.id OR p.erased IS DISTINCT FROM '["contact"]'::jsonb
      THEN 'the erasure is not of ' || c.id || '''s contact data'
    WHEN p.details IS DISTINCT FROM c.person OR p.forgot IS DISTINCT FROM '["contact"]'::jsonb
      THEN 'the erasure is not of the contact details of ' || c.id || '''s core person'
  END
  FROM (
    SELECT payload ->> 'contact' AS contact,
           payload -> 'erasure' -> '$erasure' ->> 'subject' AS subject,
           payload -> 'erasure' -> '$erasure' -> 'erased' AS erased,
           payload -> 'details' -> '$erasure' ->> 'subject' AS details,
           payload -> 'details' -> '$erasure' -> 'erased' AS forgot
  ) p
  LEFT JOIN contact.contact c ON c.id = p.contact;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('contact:contact:erase', 'contact.erases(jsonb)', 'contact');
