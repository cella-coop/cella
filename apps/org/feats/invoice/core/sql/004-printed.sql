-- What an invoice prints beyond its name and figures (code de commerce,
-- art. L441-9): the address it bills, as issued, its lines separated by
-- newlines, never blank: `invoice.identified` refuses an issue without it.
ALTER TABLE invoice.invoice ADD COLUMN bill_address text;

-- The address billed is issued with the rest and never changes either.
CREATE OR REPLACE FUNCTION invoice.stays_issued() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'line' THEN
    RAISE EXCEPTION 'the lines of % never change once issued', OLD.invoice
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF (NEW.id, NEW.series, NEW.number, NEW.issued, NEW.due, NEW.bill_to, NEW.bill_address, NEW.label,
      cella.cents(NEW.net), cella.cents(NEW.vat), cella.cents(NEW.total))
    IS DISTINCT FROM (OLD.id, OLD.series, OLD.number, OLD.issued, OLD.due, OLD.bill_to, OLD.bill_address, OLD.label,
      cella.cents(OLD.net), cella.cents(OLD.vat), cella.cents(OLD.total))
  THEN
    RAISE EXCEPTION '% is issued and never changes; void it and reissue', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.sent IS NOT NULL AND NEW.sent IS DISTINCT FROM OLD.sent THEN
    RAISE EXCEPTION '% was sent on %', OLD.id, OLD.sent USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.voided IS NOT NULL AND (NEW.voided, NEW.reason) IS DISTINCT FROM (OLD.voided, OLD.reason) THEN
    RAISE EXCEPTION '% was voided on %', OLD.id, OLD.voided USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.voided IS NOT NULL AND NEW.sent IS DISTINCT FROM OLD.sent THEN
    RAISE EXCEPTION '% is voided and is not sent', OLD.id USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

-- An invoice's VAT by rate, in cents (CGI, annexe II, art. 242 nonies A,
-- I, 10° bis): the net of its lines at each rate and the tax on it, each
-- line's tax rounded to the cent as `issue` sums it, so the rates add up
-- to the invoice's `vat`.
CREATE VIEW invoice.taxed WITH (security_invoker = true) AS
SELECT l.invoice, l.vat_rate AS rate,
       sum(cella.cents(l.amount))::bigint AS base,
       sum(round(cella.cents(l.amount) * l.vat_rate / 100))::bigint AS tax
FROM invoice.line l
GROUP BY l.invoice, l.vat_rate;

GRANT SELECT ON invoice.taxed TO cella_app, cella_guards;
