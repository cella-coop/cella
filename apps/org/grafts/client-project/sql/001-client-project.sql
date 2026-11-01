CREATE SCHEMA client_project;

-- Which client a project is for. A project without a row here is the
-- co-op's own, not invalid.
CREATE TABLE client_project.commission (
  project text PRIMARY KEY,
  client text NOT NULL
);

CREATE INDEX ON client_project.commission (client);

-- Both sides resolve: the project and the client exist.
CREATE FUNCTION client_project.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM project.project p WHERE p.id = NEW.project) THEN
    RAISE EXCEPTION 'no project %', NEW.project USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM client.client c WHERE c.id = NEW.client) THEN
    RAISE EXCEPTION 'no client %', NEW.client USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON client_project.commission
  FOR EACH ROW EXECUTE FUNCTION client_project.resolves();

GRANT USAGE ON SCHEMA client_project TO cella_app, cella_guards;
GRANT SELECT ON client_project.commission TO cella_app, cella_guards;
GRANT INSERT, UPDATE ON client_project.commission TO cella_app;
