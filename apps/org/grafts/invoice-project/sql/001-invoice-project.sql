CREATE SCHEMA invoice_project;

-- Which project an invoice bills work of. An invoice without a row here
-- bills no project, which is not invalid.
CREATE TABLE invoice_project.charge (
  invoice text PRIMARY KEY,
  project text NOT NULL
);

CREATE INDEX ON invoice_project.charge (project);

-- Both sides resolve: the invoice and the project exist.
CREATE FUNCTION invoice_project.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM invoice.invoice i WHERE i.id = NEW.invoice) THEN
    RAISE EXCEPTION 'no invoice %', NEW.invoice USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM project.project p WHERE p.id = NEW.project) THEN
    RAISE EXCEPTION 'no project %', NEW.project USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON invoice_project.charge
  FOR EACH ROW EXECUTE FUNCTION invoice_project.resolves();

-- What each project has invoiced, net of VAT and voids, in cents.
CREATE VIEW invoice_project.invoiced AS
SELECT c.project, coalesce(sum(cella.cents(i.net)) FILTER (WHERE i.voided IS NULL), 0)::bigint AS net
FROM invoice_project.charge c
JOIN invoice.invoice i ON i.id = c.invoice
GROUP BY c.project;

GRANT USAGE ON SCHEMA invoice_project TO cella_app, cella_guards;
GRANT SELECT ON invoice_project.charge, invoice_project.invoiced TO cella_app, cella_guards;
GRANT INSERT, UPDATE ON invoice_project.charge TO cella_app;
