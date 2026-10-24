CREATE SCHEMA invoice;

-- A series and the right to number in it. `issue` is bounded: it spends
-- the next number from the right granted in advance and waits only when the
-- right runs out. `until` is the last number the right covers; at rung 1 the
-- server holds the only right, granted without end (`until` is NULL), so it
-- never runs out. A device's right at rung 2 has an end, and a number past
-- it needs a fresh grant, which is ordered.
CREATE TABLE invoice.series (
  name text PRIMARY KEY,
  next integer NOT NULL CHECK (next > 0),
  until integer CHECK (until > 0)
);

-- What appears on the invoice as issued. The client record it bills is the
-- client-invoice graft's; `bill_to` is the name as printed. A NULL `vat`
-- is an invoice without VAT.
CREATE TABLE invoice.invoice (
  id text PRIMARY KEY,
  series text NOT NULL REFERENCES invoice.series,
  number integer NOT NULL CHECK (number > 0),
  issued date NOT NULL,
  due date NOT NULL,
  bill_to text NOT NULL,
  label text NOT NULL,
  net cella.amount NOT NULL,
  vat cella.amount,
  total cella.amount NOT NULL,
  sent date,
  voided date,
  reason text,
  UNIQUE (series, number),
  CHECK (cella.cents(total) = cella.cents(net) + coalesce(cella.cents(vat), 0)),
  CHECK ((voided IS NULL) = (reason IS NULL)),
  CHECK (due >= issued)
);

CREATE TABLE invoice.line (
  invoice text NOT NULL REFERENCES invoice.invoice,
  n integer NOT NULL CHECK (n > 0),
  description text NOT NULL,
  quantity numeric(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price cella.amount NOT NULL,
  amount cella.amount NOT NULL,
  -- A percentage: 20 for France's standard rate.
  vat_rate numeric(5, 2) NOT NULL CHECK (vat_rate >= 0),
  PRIMARY KEY (invoice, n),
  CHECK (cella.cents(amount) = round(quantity * cella.cents(unit_price)))
);

-- Money received, a fact from the bank, ordered by its receipt. The bank's
-- reference names the transfer: the same one recorded twice is one payment.
CREATE TABLE invoice.payment (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice text NOT NULL REFERENCES invoice.invoice,
  receipt bigint NOT NULL UNIQUE,
  at date NOT NULL,
  amount cella.amount NOT NULL,
  method text NOT NULL DEFAULT 'transfer',
  reference text NOT NULL,
  UNIQUE (invoice, reference)
);

-- An invoice's id: its series and its number, `F-2026-0056`.
CREATE FUNCTION invoice.number_id(series text, number integer) RETURNS text
LANGUAGE sql IMMUTABLE
RETURN series || '-' || lpad(number::text, 4, '0');

-- Spends the next number of a series from its right. A number already
-- issued is never issued again; a right that has run out refuses, since
-- what follows is an ordered grant.
CREATE FUNCTION invoice.spend(name text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  n integer;
  upto integer;
BEGIN
  UPDATE invoice.series s SET next = s.next + 1 WHERE s.name = spend.name
    RETURNING s.next - 1, s.until INTO n, upto;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no series %', name USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF upto IS NOT NULL AND n > upto THEN
    RAISE EXCEPTION 'the right to % ends at %; a further number needs a new grant', name, upto
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF EXISTS (SELECT FROM invoice.invoice i WHERE i.series = spend.name AND i.number = n) THEN
    RAISE EXCEPTION '% is already issued: a number is never reused', invoice.number_id(name, n)
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN n;
END
$$;

-- An invoice's net is the sum of its lines. Deferred, as its lines follow it.
CREATE FUNCTION invoice.adds_up() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ref text;
  net bigint;
  lines bigint;
BEGIN
  IF TG_TABLE_NAME = 'invoice' THEN
    ref := NEW.id;
  ELSE
    ref := NEW.invoice;
  END IF;
  SELECT cella.cents(i.net), (SELECT sum(cella.cents(l.amount)) FROM invoice.line l WHERE l.invoice = i.id)
  INTO net, lines
  FROM invoice.invoice i WHERE i.id = ref;
  IF lines IS DISTINCT FROM net THEN
    RAISE EXCEPTION '%: the lines make % cents, the net %', ref, coalesce(lines, 0), net
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER adds_up AFTER INSERT ON invoice.invoice
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION invoice.adds_up();
CREATE CONSTRAINT TRIGGER adds_up AFTER INSERT ON invoice.line
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION invoice.adds_up();

-- An issued invoice never changes: it is sent once, voided once, and a
-- voided invoice is not sent again. A correction is a void and a reissue.
CREATE FUNCTION invoice.stays_issued() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'line' THEN
    RAISE EXCEPTION 'the lines of % never change once issued', OLD.invoice
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF (NEW.id, NEW.series, NEW.number, NEW.issued, NEW.due, NEW.bill_to, NEW.label,
      cella.cents(NEW.net), cella.cents(NEW.vat), cella.cents(NEW.total))
    IS DISTINCT FROM (OLD.id, OLD.series, OLD.number, OLD.issued, OLD.due, OLD.bill_to, OLD.label,
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

CREATE TRIGGER stays_issued BEFORE UPDATE ON invoice.invoice
  FOR EACH ROW EXECUTE FUNCTION invoice.stays_issued();
CREATE TRIGGER stays_issued BEFORE UPDATE OR DELETE ON invoice.line
  FOR EACH ROW EXECUTE FUNCTION invoice.stays_issued();

-- Where each invoice stands, read from its payments, in cents. A payment
-- beyond the total is not refused: the excess is a credit owed to the
-- client. On a voided invoice everything paid is owed back.
CREATE VIEW invoice.standing AS
SELECT i.id, i.bill_to, i.due, cella.cents(i.total) AS total, coalesce(p.paid, 0) AS paid,
  CASE WHEN i.voided IS NOT NULL THEN 0
       ELSE greatest(cella.cents(i.total) - coalesce(p.paid, 0), 0) END AS owed,
  CASE WHEN i.voided IS NOT NULL THEN coalesce(p.paid, 0)
       ELSE greatest(coalesce(p.paid, 0) - cella.cents(i.total), 0) END AS credit,
  CASE WHEN i.voided IS NOT NULL THEN 'voided'
       WHEN coalesce(p.paid, 0) = 0 THEN 'unpaid'
       WHEN p.paid < cella.cents(i.total) THEN 'partial'
       WHEN p.paid = cella.cents(i.total) THEN 'paid'
       ELSE 'overpaid' END AS state
FROM invoice.invoice i
LEFT JOIN (
  SELECT invoice, sum(cella.cents(amount))::bigint AS paid FROM invoice.payment GROUP BY invoice
) p ON p.invoice = i.id;

-- invoice:invoice:issue — the write issued the invoice on the verdict
-- date, with the series' last number, the one after the number before it,
-- and not dated before it.
CREATE FUNCTION invoice.numbered(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN i.id IS NULL THEN 'no invoice ' || coalesce(x.id, 'is named')
    WHEN i.issued IS DISTINCT FROM cella.verdict_date() THEN i.id || ' was not issued by this write'
    WHEN s.next IS DISTINCT FROM i.number + 1 THEN i.id || ' is not the last number of ' || i.series
    WHEN i.number > 1 AND NOT EXISTS (
      SELECT FROM invoice.invoice q WHERE q.series = i.series AND q.number = i.number - 1
    ) THEN i.id || ' leaves a gap: ' || invoice.number_id(i.series, i.number - 1) || ' was never issued'
    WHEN EXISTS (
      SELECT FROM invoice.invoice q WHERE q.series = i.series AND q.number < i.number AND q.issued > i.issued
    ) THEN i.id || ' is dated before an earlier number of ' || i.series
  END
  FROM (SELECT payload ->> 'invoice' AS id) x
  LEFT JOIN invoice.invoice i ON i.id = x.id
  LEFT JOIN invoice.series s ON s.name = i.series;
END;

-- invoice:invoice:void — the write voided the invoice on the verdict date,
-- and no payment was received before it: a paid invoice is not voided.
CREATE FUNCTION invoice.voids(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN i.id IS NULL THEN 'no invoice ' || coalesce(x.id, 'is named')
    WHEN i.voided IS DISTINCT FROM cella.verdict_date() THEN i.id || ' was not voided by this write'
    WHEN EXISTS (SELECT FROM invoice.payment p WHERE p.invoice = i.id)
      THEN i.id || ' has a payment, so it is not voided; refund or apply what was paid'
  END
  FROM (SELECT payload ->> 'invoice' AS id) x
  LEFT JOIN invoice.invoice i ON i.id = x.id;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('invoice:invoice:issue', 'invoice.numbered(jsonb)', 'invoice'),
  ('invoice:invoice:void', 'invoice.voids(jsonb)', 'invoice');

GRANT USAGE ON SCHEMA invoice TO cella_app, cella_rules;
GRANT SELECT ON ALL TABLES IN SCHEMA invoice TO cella_app, cella_rules;
GRANT INSERT ON invoice.invoice, invoice.line, invoice.payment TO cella_app;
GRANT UPDATE (sent, voided, reason) ON invoice.invoice TO cella_app;
GRANT UPDATE (next) ON invoice.series TO cella_app;
