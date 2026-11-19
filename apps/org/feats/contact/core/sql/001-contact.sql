CREATE SCHEMA contact;

-- Companies and people in one collection; a contact at a company is a
-- person whose parent is that company, and a client is a contact holding
-- the client role. A person contact is a core person, by their address:
-- their name, email and phone are core's, and the contact keeps what the
-- coop knows of them. A company keeps its own. Personal data is
-- committed to in the log, never written into it. The core person is
-- checked at the end of the transaction, since a fold applies the
-- contact's own state before core's.
CREATE TABLE contact.contact (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY,
  kind text NOT NULL DEFAULT 'company' CHECK (kind IN ('company', 'person')),
  person text REFERENCES person.person DEFERRABLE INITIALLY DEFERRED,
  name text,
  form text,
  email text,
  phone text,
  address jsonb,
  parent text REFERENCES contact.contact,
  tags text[] NOT NULL DEFAULT '{}',
  -- The client role, by its stage: NULL for a contact that is no client.
  client text CHECK (client IN ('lead', 'active', 'inactive')),
  -- Hidden from lists, kept for the books; every contact's, client or not.
  archived boolean NOT NULL DEFAULT false,
  CHECK (parent IS DISTINCT FROM id)
);

CREATE INDEX ON contact.contact (person);

COMMENT ON COLUMN contact.contact.person IS 'not personal: the pseudonymous address core person names the person by';

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

-- A person contact names its core person and keeps no name, email or
-- phone of its own, which are core's and changed by the person's
-- profile; a company names no person and keeps its own name. An erased
-- company's or person's `redacted` stays as the notary wrote it.
CREATE FUNCTION contact.person_is_core() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'person' AND NEW.person IS NULL THEN
    RAISE EXCEPTION '% is a person contact naming no person: name them by the address they are known by', NEW.id
      USING ERRCODE = 'triggered_action_exception';
  ELSIF NEW.kind = 'person' AND (NEW.name IS NOT NULL OR NEW.email IS NOT NULL OR NEW.phone IS NOT NULL) THEN
    RAISE EXCEPTION '% is a person: their name, email and phone are core person''s, which they keep by their profile', NEW.id
      USING ERRCODE = 'triggered_action_exception';
  ELSIF NEW.kind = 'company' AND NEW.person IS NOT NULL THEN
    RAISE EXCEPTION '% is a company, which is no person: leave its person empty', NEW.id
      USING ERRCODE = 'triggered_action_exception';
  ELSIF NEW.kind = 'company' AND NEW.name IS NULL THEN
    RAISE EXCEPTION '% is a company with no name: give it one', NEW.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER person_is_core BEFORE INSERT OR UPDATE ON contact.contact
  FOR EACH ROW EXECUTE FUNCTION contact.person_is_core();

-- Every contact with its name, email and phone: a person's are core's,
-- read under core's row-level policy as the reader reads them, and a
-- company's its own.
CREATE VIEW contact.named WITH (security_invoker = true) AS
SELECT c.circle, c.id, c.kind, c.person,
       coalesce(p.name, c.name) AS name,
       coalesce(p.email, c.email) AS email,
       coalesce(p.phone, c.phone) AS phone,
       c.form, c.address, c.parent, c.tags, c.client, c.archived
FROM contact.contact c
LEFT JOIN person.person p ON p.address = c.person;

GRANT USAGE ON SCHEMA contact TO cella_app, cella_guards;
GRANT SELECT, INSERT, UPDATE ON contact.contact TO cella_app;
GRANT SELECT ON contact.contact TO cella_guards;
GRANT SELECT ON contact.named TO cella_app, cella_guards;
