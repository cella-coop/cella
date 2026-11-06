CREATE SCHEMA contact;

-- Companies and people in one collection; a contact at a company is a
-- person whose parent is that company. A person's email and phone are
-- personal data: the log commits to which fields a write changed, never to
-- their values.
CREATE TABLE contact.contact (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY,
  kind text NOT NULL DEFAULT 'company' CHECK (kind IN ('company', 'person')),
  name text NOT NULL,
  form text,
  email text,
  phone text,
  address jsonb,
  parent text REFERENCES contact.contact,
  tags text[] NOT NULL DEFAULT '{}',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('lead', 'active', 'inactive', 'archived')),
  CHECK (parent IS DISTINCT FROM id)
);

-- A contact's parent is a company.
CREATE FUNCTION contact.parent_is_company() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent IS NOT NULL AND NOT EXISTS (
    SELECT FROM contact.contact c WHERE c.id = NEW.parent AND c.kind = 'company'
  ) THEN
    RAISE EXCEPTION '% is no company, so % cannot be under it', NEW.parent, NEW.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER parent_is_company BEFORE INSERT OR UPDATE OF parent ON contact.contact
  FOR EACH ROW EXECUTE FUNCTION contact.parent_is_company();

GRANT USAGE ON SCHEMA contact TO cella_app, cella_guards;
GRANT SELECT, INSERT, UPDATE ON contact.contact TO cella_app;
GRANT SELECT ON contact.contact TO cella_guards;
