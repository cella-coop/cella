-- What of a person is personal data, by class: their name, of class
-- `profile`, kept while they belong or work here and erased once they have
-- left; their email and phone, of class `contact`, which they may erase
-- themselves; and the label each of their devices goes by, their own
-- wording, of class `profile`. Their address is the pseudonym every entry
-- names them by.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('person', 'person', 'name', 'profile', 'address', 'person'),
  ('person', 'person', 'email', 'contact', 'address', 'person'),
  ('person', 'person', 'phone', 'contact', 'address', 'person'),
  ('person', 'device', 'label', 'profile', 'address', 'person');

COMMENT ON COLUMN person.person.address IS 'not personal: the pseudonymous address every log entry names the person by';

-- person:person:forget — a person erases their own contact details, and
-- no one else's, and nothing more.
CREATE FUNCTION person.forgets(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.subject IS NULL THEN 'the write erases nothing'
    WHEN p.subject IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not erase ' || p.subject || '''s contact details'
    WHEN p.erased IS DISTINCT FROM '["contact"]'::jsonb OR p.restricted IS DISTINCT FROM '[]'::jsonb
      THEN 'a person erases their contact details alone'
  END
  FROM (
    SELECT payload -> 'erasure' -> '$erasure' ->> 'subject' AS subject,
           payload -> 'erasure' -> '$erasure' -> 'erased' AS erased,
           payload -> 'erasure' -> '$erasure' -> 'restricted' AS restricted
  ) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('person:person:forget', 'person.forgets(jsonb)', 'person');
