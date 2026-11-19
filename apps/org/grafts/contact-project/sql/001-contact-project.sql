CREATE SCHEMA contact_project;

-- Which contact a project is for. A project without a row here is the
-- coop's own, not invalid.
CREATE TABLE contact_project.commission (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  project text PRIMARY KEY,
  contact text NOT NULL
);

CREATE INDEX ON contact_project.commission (contact);

-- Both sides resolve: the project and the contact exist, and the contact is a
-- client, holding the client role, when the link is made.
CREATE FUNCTION contact_project.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM project.project p WHERE p.id = NEW.project) THEN
    RAISE EXCEPTION 'no project %', NEW.project USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM contact.contact c WHERE c.id = NEW.contact) THEN
    RAISE EXCEPTION 'no contact %', NEW.contact USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM contact.contact c WHERE c.id = NEW.contact AND c.client IS NOT NULL) THEN
    RAISE EXCEPTION '% is no client, so no project is for it: set its client role on its page first', NEW.contact
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON contact_project.commission
  FOR EACH ROW EXECUTE FUNCTION contact_project.resolves();

GRANT USAGE ON SCHEMA contact_project TO cella_app, cella_guards;
GRANT SELECT ON contact_project.commission TO cella_app, cella_guards;
GRANT INSERT, UPDATE ON contact_project.commission TO cella_app;
