-- An agenda item's presenter names a person, in the words its adder gave:
-- personal data of class `profile`, erased when asked. No column names
-- whose it is, so its subject is the item, as a contact is its own, by
-- its id as text, `ref`, which a trigger keeps, since a subject is text.
-- A write commits to it in the log, and the vault keeps it.
ALTER TABLE meeting.item ADD COLUMN ref text NOT NULL;

CREATE FUNCTION meeting.item_ref() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.ref := NEW.id::text;
  RETURN NEW;
END
$$;

CREATE TRIGGER ref BEFORE INSERT OR UPDATE OF id ON meeting.item
  FOR EACH ROW EXECUTE FUNCTION meeting.item_ref();

INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('meeting', 'item', 'presenter', 'profile', 'ref', 'meeting');
