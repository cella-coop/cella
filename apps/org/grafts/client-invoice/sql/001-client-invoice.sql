CREATE SCHEMA client_invoice;

-- Which client an invoice bills. An invoice without a row here is
-- unbilled, not invalid; it still carries the name it bills as text.
CREATE TABLE client_invoice.billing (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  invoice text PRIMARY KEY,
  client text NOT NULL
);

CREATE INDEX ON client_invoice.billing (client);

-- Both sides resolve: the invoice and the client exist.
CREATE FUNCTION client_invoice.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM invoice.invoice i WHERE i.id = NEW.invoice) THEN
    RAISE EXCEPTION 'no invoice %', NEW.invoice USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM client.client c WHERE c.id = NEW.client) THEN
    RAISE EXCEPTION 'no client %', NEW.client USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON client_invoice.billing
  FOR EACH ROW EXECUTE FUNCTION client_invoice.resolves();

-- What each client owes and is owed, in cents, from its invoices' standing:
-- `credit` is what the co-op owes back, from overpayments and payments on
-- voided invoices.
CREATE VIEW client_invoice.standing WITH (security_invoker = true) AS
SELECT c.id AS client, c.name,
       coalesce(sum(s.owed), 0)::bigint AS owed,
       coalesce(sum(s.credit), 0)::bigint AS credit
FROM client.client c
LEFT JOIN client_invoice.billing b ON b.client = c.id
LEFT JOIN invoice.standing s ON s.id = b.invoice
GROUP BY c.id, c.name;

GRANT USAGE ON SCHEMA client_invoice TO cella_app, cella_guards;
GRANT SELECT ON client_invoice.billing, client_invoice.standing TO cella_app, cella_guards;
GRANT INSERT, UPDATE ON client_invoice.billing TO cella_app;
