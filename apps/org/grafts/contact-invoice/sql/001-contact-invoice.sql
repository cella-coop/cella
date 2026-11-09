CREATE SCHEMA contact_invoice;

-- Which contact an invoice bills. An invoice without a row here is
-- unbilled, not invalid; it still carries the name it bills as text.
CREATE TABLE contact_invoice.billing (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  invoice text PRIMARY KEY,
  contact text NOT NULL
);

CREATE INDEX ON contact_invoice.billing (contact);

-- Both sides resolve: the invoice and the contact exist, and the contact is a
-- client, holding the client role, when the link is made.
CREATE FUNCTION contact_invoice.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM invoice.invoice i WHERE i.id = NEW.invoice) THEN
    RAISE EXCEPTION 'no invoice %', NEW.invoice USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM contact.contact c WHERE c.id = NEW.contact) THEN
    RAISE EXCEPTION 'no contact %', NEW.contact USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM contact.contact c WHERE c.id = NEW.contact AND c.client IS NOT NULL) THEN
    RAISE EXCEPTION '% is no client, so no invoice bills it: set its client role on its page first', NEW.contact
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON contact_invoice.billing
  FOR EACH ROW EXECUTE FUNCTION contact_invoice.resolves();

-- What each contact owes and is owed, in cents, from its invoices' standing:
-- `credit` is what the co-op owes back, from overpayments and payments on
-- voided invoices.
CREATE VIEW contact_invoice.standing WITH (security_invoker = true) AS
SELECT c.id AS contact, c.name,
       coalesce(sum(s.owed), 0)::bigint AS owed,
       coalesce(sum(s.credit), 0)::bigint AS credit
FROM contact.named c
LEFT JOIN contact_invoice.billing b ON b.contact = c.id
LEFT JOIN invoice.standing s ON s.id = b.invoice
GROUP BY c.id, c.name;

GRANT USAGE ON SCHEMA contact_invoice TO cella_app, cella_guards;
GRANT SELECT ON contact_invoice.billing, contact_invoice.standing TO cella_app, cella_guards;
GRANT INSERT, UPDATE ON contact_invoice.billing TO cella_app;
