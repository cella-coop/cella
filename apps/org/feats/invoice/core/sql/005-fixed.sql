-- The seller as an invoice names it (code de commerce, art. R123-237; CGI,
-- annexe II, art. 242 nonies A, I, 2°): the coop's particulars in force
-- when the invoice issues (`circle.particulars()`), its legal name and
-- beside it, a value they mark none of being null; `invoice.identified`
-- refuses an issue without any but the capital, and the VAT number where
-- no line carries VAT.
CREATE FUNCTION invoice.seller() RETURNS jsonb LANGUAGE sql STABLE
RETURN (
  SELECT jsonb_build_object('name', p.legal_name, 'form', p.form, 'capital', p.capital, 'siren', p.siren,
                            'rcs', p.rcs, 'vat', p.vat, 'seat', p.seat)
  FROM (SELECT) one LEFT JOIN circle.particulars() p ON true);

-- Kept with the invoice as it issues, so a seat that moves or a form that
-- changes later never alters an invoice issued before.
ALTER TABLE invoice.invoice ADD COLUMN seller jsonb NOT NULL DEFAULT invoice.seller();

-- The seller is issued with the rest and never changes either. The name
-- and address billed and the reason for a void, personal data of class
-- `books` (`009-billed.sql`), change only as their clock running out
-- redacts them (`cella.redact`), a column made `redacted` reading as it was.
CREATE OR REPLACE FUNCTION invoice.stays_issued() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'line' THEN
    RAISE EXCEPTION 'the lines of % never change once issued', OLD.invoice
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF (NEW.id, NEW.series, NEW.number, NEW.issued, NEW.due,
      CASE WHEN NEW.bill_to = 'redacted' THEN OLD.bill_to ELSE NEW.bill_to END,
      CASE WHEN NEW.bill_address = 'redacted' THEN OLD.bill_address ELSE NEW.bill_address END, NEW.seller, NEW.label,
      cella.cents(NEW.net), cella.cents(NEW.vat), cella.cents(NEW.total))
    IS DISTINCT FROM (OLD.id, OLD.series, OLD.number, OLD.issued, OLD.due, OLD.bill_to, OLD.bill_address, OLD.seller, OLD.label,
      cella.cents(OLD.net), cella.cents(OLD.vat), cella.cents(OLD.total))
  THEN
    RAISE EXCEPTION '% is issued and never changes; void it and reissue', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.sent IS NOT NULL AND NEW.sent IS DISTINCT FROM OLD.sent THEN
    RAISE EXCEPTION '% was sent on %', OLD.id, OLD.sent USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.voided IS NOT NULL AND (NEW.voided, CASE WHEN NEW.reason = 'redacted' THEN OLD.reason ELSE NEW.reason END)
    IS DISTINCT FROM (OLD.voided, OLD.reason) THEN
    RAISE EXCEPTION '% was voided on %', OLD.id, OLD.voided USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.voided IS NOT NULL AND NEW.sent IS DISTINCT FROM OLD.sent THEN
    RAISE EXCEPTION '% is voided and is not sent', OLD.id USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;
