CREATE SCHEMA bill;

CREATE SEQUENCE bill.number;

-- A supplier's bill, as it came: who sent it and their own number for it,
-- the date it bears and when it falls due, what it was for, the account of
-- class 6 it is charged to, and its amounts, counted line by line by the
-- VAT core library (a NULL `vat` is a bill without VAT). Then who recorded
-- it, who approved it and when it was paid. The supplier is a name, as
-- text; a supplier as a record of its own waits on a contact feat.
CREATE TABLE bill.bill (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY DEFAULT 'bi-' || to_char(nextval('bill.number'), 'FM9999999999999990000'),
  supplier text NOT NULL CHECK (supplier <> ''),
  reference text NOT NULL CHECK (reference <> ''),
  issued date NOT NULL,
  due date NOT NULL,
  label text NOT NULL CHECK (label <> ''),
  category text NOT NULL CHECK (category ~ '^6[0-9]+$'),
  net cella.amount NOT NULL,
  vat cella.amount,
  total cella.amount NOT NULL,
  status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'approved', 'paid')),
  recorded date NOT NULL,
  recorder text NOT NULL,
  approved date,
  approver text,
  paid date,
  UNIQUE (supplier, reference),
  CHECK (cella.cents(total) = cella.cents(net) + coalesce(cella.cents(vat), 0)),
  CHECK (due >= issued),
  CHECK ((approved IS NULL) = (approver IS NULL)),
  CHECK ((status IN ('approved', 'paid')) = (approved IS NOT NULL)),
  CHECK ((status = 'paid') = (paid IS NOT NULL))
);

CREATE INDEX ON bill.bill (status, due);

CREATE TABLE bill.line (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  bill text NOT NULL REFERENCES bill.bill,
  n integer NOT NULL CHECK (n > 0),
  description text NOT NULL,
  quantity numeric(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price cella.amount NOT NULL,
  amount cella.amount NOT NULL,
  -- A percentage: 20 for France's standard rate.
  vat_rate numeric(5, 2) NOT NULL CHECK (vat_rate >= 0),
  PRIMARY KEY (bill, n),
  CHECK (cella.cents(amount) = cella.line_amount(quantity, cella.cents(unit_price)))
);

-- A bill's net is the sum of its lines, and its VAT the sum of their VAT.
-- Deferred, as its lines follow it.
CREATE FUNCTION bill.adds_up() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ref text;
  net bigint;
  vat bigint;
  lines bigint;
  taxed bigint;
BEGIN
  IF TG_TABLE_NAME = 'bill' THEN
    ref := NEW.id;
  ELSE
    ref := NEW.bill;
  END IF;
  SELECT cella.cents(b.net), coalesce(cella.cents(b.vat), 0), l.amount, l.vat
  INTO net, vat, lines, taxed
  FROM bill.bill b
  LEFT JOIN LATERAL (
    SELECT sum(cella.cents(x.amount)) AS amount, sum(cella.line_vat(cella.cents(x.amount), x.vat_rate)) AS vat
    FROM bill.line x WHERE x.bill = b.id
  ) l ON true
  WHERE b.id = ref;
  IF lines IS DISTINCT FROM net THEN
    RAISE EXCEPTION '%: the lines make % cents, the net %', ref, coalesce(lines, 0), net
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF coalesce(taxed, 0) <> vat THEN
    RAISE EXCEPTION '%: the lines'' VAT makes % cents, the bill %', ref, coalesce(taxed, 0), vat
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER adds_up AFTER INSERT ON bill.bill
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bill.adds_up();
CREATE CONSTRAINT TRIGGER adds_up AFTER INSERT ON bill.line
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bill.adds_up();

-- A bill moves only along its lifecycle, recorded, approved, then paid,
-- each once; its figures and its lines never change once recorded. Its
-- body, its free-form discussion, is neither: the trigger on a bill fires
-- on an update that sets any column but the body, so a save of the body
-- alone passes at any step, and when repeated. It fires by the columns an
-- update sets, not by the values it changes: approving or paying a bill
-- a second time sets its status to the one it holds, and is refused as
-- "already". A column `bill.bill` gains is added to its list.
CREATE FUNCTION bill.moves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'line' THEN
    RAISE EXCEPTION 'the lines of % never change once recorded', OLD.bill
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% was recorded and is never deleted', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF (NEW.id, NEW.supplier, NEW.reference, NEW.issued, NEW.due, NEW.label, NEW.category,
      cella.cents(NEW.net), cella.cents(NEW.vat), cella.cents(NEW.total), NEW.recorded, NEW.recorder)
    IS DISTINCT FROM (OLD.id, OLD.supplier, OLD.reference, OLD.issued, OLD.due, OLD.label, OLD.category,
      cella.cents(OLD.net), cella.cents(OLD.vat), cella.cents(OLD.total), OLD.recorded, OLD.recorder)
  THEN
    RAISE EXCEPTION '% was recorded: its figures never change', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NEW.status = OLD.status THEN
    RAISE EXCEPTION '% is % already', OLD.id, OLD.status
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF (OLD.status, NEW.status) NOT IN (('recorded', 'approved'), ('approved', 'paid')) THEN
    RAISE EXCEPTION '% is %, and cannot become %', OLD.id, OLD.status, NEW.status
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER moves BEFORE UPDATE OF circle, id, supplier, reference, issued, due, label, category, net, vat, total, status, recorded, recorder, approved, approver, paid OR DELETE ON bill.bill
  FOR EACH ROW EXECUTE FUNCTION bill.moves();
CREATE TRIGGER moves BEFORE UPDATE OR DELETE ON bill.line
  FOR EACH ROW EXECUTE FUNCTION bill.moves();

-- A bill's VAT by rate, in cents: the net of its lines at each rate and
-- the tax on it, each line's rounded by `cella.line_vat`, so the rates add
-- up to the bill's `vat`.
CREATE VIEW bill.taxed WITH (security_invoker = true) AS
SELECT l.bill, l.vat_rate AS rate,
       sum(cella.cents(l.amount))::bigint AS base,
       sum(cella.line_vat(cella.cents(l.amount), l.vat_rate))::bigint AS tax
FROM bill.line l
GROUP BY l.bill, l.vat_rate;

-- bill:bill:record — the bill was recorded on the verdict date by the
-- actor, unless the write merged into one recorded before.
CREATE FUNCTION bill.records(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN b.id IS NULL THEN 'no bill ' || coalesce(x.bill, 'is named')
    WHEN x.merged THEN NULL
    WHEN b.recorded IS DISTINCT FROM cella.verdict_date() OR b.recorder IS DISTINCT FROM cella.actor()
      THEN b.id || ' was not recorded by this write'
  END
  FROM (SELECT payload ->> 'bill' AS bill, coalesce((payload ->> 'merged')::boolean, false) AS merged) x
  LEFT JOIN bill.bill b ON b.id = x.bill;
END;

-- bill:bill:approve — the write approved a recorded bill on the verdict
-- date, as someone other than who recorded it, for the total the payload
-- names, so a mandate's limit caps what was approved.
CREATE FUNCTION bill.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN b.id IS NULL THEN 'no bill ' || coalesce(x.bill, 'is named')
    WHEN b.status <> 'approved' OR b.approved IS DISTINCT FROM cella.verdict_date() THEN b.id || ' was not approved by this write'
    WHEN b.approver = b.recorder THEN b.recorder || ' recorded ' || b.id || ', and may not approve it too'
    WHEN b.approver IS DISTINCT FROM cella.actor() THEN b.id || ' was not approved by this write'
    WHEN x.amount IS DISTINCT FROM cella.cents(b.total)
      THEN b.id || ' comes to ' || cella.cents(b.total) || ' cents, not ' || coalesce(x.amount::text, 'no amount')
  END
  FROM (SELECT payload ->> 'bill' AS bill, (payload ->> 'amount')::bigint AS amount) x
  LEFT JOIN bill.bill b ON b.id = x.bill;
END;

-- bill:bill:pay — the write paid an approved bill on the verdict date, for
-- its whole total.
CREATE FUNCTION bill.pays(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN b.id IS NULL THEN 'no bill ' || coalesce(x.bill, 'is named')
    WHEN b.status <> 'paid' OR b.paid IS DISTINCT FROM cella.verdict_date() THEN b.id || ' was not paid by this write'
    WHEN x.amount IS DISTINCT FROM cella.cents(b.total)
      THEN b.id || ' comes to ' || cella.cents(b.total) || ' cents, not ' || coalesce(x.amount::text, 'no amount')
  END
  FROM (SELECT payload ->> 'bill' AS bill, (payload ->> 'amount')::bigint AS amount) x
  LEFT JOIN bill.bill b ON b.id = x.bill;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('bill:bill:record', 'bill.records(jsonb)', 'bill'),
  ('bill:bill:approve', 'bill.approves(jsonb)', 'bill'),
  ('bill:bill:pay', 'bill.pays(jsonb)', 'bill');

GRANT USAGE ON SCHEMA bill TO cella_app, cella_guards;
GRANT SELECT ON ALL TABLES IN SCHEMA bill TO cella_app, cella_guards;
GRANT INSERT ON bill.bill, bill.line TO cella_app;
GRANT UPDATE (status, approved, approver, paid) ON bill.bill TO cella_app;
GRANT USAGE ON SEQUENCE bill.number TO cella_app;

-- A bill's line is in its bill's circle, copied as it is made; a line
-- made in the statement that makes its bill, which it cannot see yet,
-- names the bill's circle itself.
CREATE FUNCTION bill.in_its_circle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.circle := coalesce((SELECT b.circle FROM bill.bill b WHERE b.id = NEW.bill), NEW.circle);
  RETURN NEW;
END
$$;

CREATE TRIGGER in_its_circle BEFORE INSERT ON bill.line
  FOR EACH ROW EXECUTE FUNCTION bill.in_its_circle();
