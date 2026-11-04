-- The seller as an invoice names it (code de commerce, art. R123-237; CGI,
-- annexe II, art. 242 nonies A, I, 2°): the scope's settings when the
-- invoice issues, `cella.scope_legal_name` and beside it, a setting not
-- made being null; `invoice.identified` refuses an issue without any but
-- the capital, and the VAT number where no line carries VAT.
CREATE FUNCTION invoice.seller() RETURNS jsonb LANGUAGE sql STABLE
RETURN jsonb_build_object(
  'name', nullif(current_setting('cella.scope_legal_name', true), ''),
  'form', nullif(current_setting('cella.scope_form', true), ''),
  'capital', nullif(current_setting('cella.scope_capital', true), ''),
  'siren', nullif(current_setting('cella.scope_siren', true), ''),
  'rcs', nullif(current_setting('cella.scope_rcs', true), ''),
  'vat', nullif(current_setting('cella.scope_vat', true), ''),
  'seat', nullif(current_setting('cella.scope_seat', true), ''));

-- Kept with the invoice as it issues, so a seat that moves or a form that
-- changes later never alters an invoice issued before. An invoice issued
-- before it was kept takes the settings at this upgrade.
ALTER TABLE invoice.invoice ADD COLUMN seller jsonb NOT NULL DEFAULT invoice.seller();

-- The seller is issued with the rest and never changes either.
CREATE OR REPLACE FUNCTION invoice.stays_issued() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'line' THEN
    RAISE EXCEPTION 'the lines of % never change once issued', OLD.invoice
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF (NEW.id, NEW.series, NEW.number, NEW.issued, NEW.due, NEW.bill_to, NEW.bill_address, NEW.seller, NEW.label,
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
  IF OLD.voided IS NOT NULL AND (NEW.voided, NEW.reason) IS DISTINCT FROM (OLD.voided, OLD.reason) THEN
    RAISE EXCEPTION '% was voided on %', OLD.id, OLD.voided USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.voided IS NOT NULL AND NEW.sent IS DISTINCT FROM OLD.sent THEN
    RAISE EXCEPTION '% is voided and is not sent', OLD.id USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;
