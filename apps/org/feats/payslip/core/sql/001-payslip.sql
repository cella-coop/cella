CREATE SCHEMA payslip;

-- What the coop pays: the rates of the contributions on gross pay, the
-- employee's taken from it and the employer's on top of it, until an
-- integration computes them line by line; and the widest ratio its guards
-- allow between the highest and the lowest salary.
CREATE TABLE payslip.terms (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  one boolean PRIMARY KEY DEFAULT true CHECK (one),
  employee numeric(5, 2) NOT NULL CHECK (employee >= 0 AND employee < 100),
  employer numeric(5, 2) NOT NULL CHECK (employer >= 0),
  ratio numeric(4, 2) NOT NULL CHECK (ratio >= 1)
);

-- A member's monthly gross salary from a day on, until its last day where
-- it has one, in force on each day between, both included, until a later
-- one replaces it. The member is an address, as text; that it is a
-- worker's, and ends when they leave, is the employment-payslip graft's.
CREATE TABLE payslip.salary (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  member text NOT NULL,
  "from" date NOT NULL,
  until date,
  gross cella.amount NOT NULL,
  PRIMARY KEY (member, "from"),
  CHECK (until IS NULL OR until >= "from")
);

-- A month's pay run: prepared, then approved, then paid, each once.
CREATE TABLE payslip.run (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  month text PRIMARY KEY CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  generated date NOT NULL,
  approved date,
  approver text,
  paid date,
  CHECK ((approved IS NULL) = (approver IS NULL)),
  CHECK (paid IS NULL OR approved IS NOT NULL)
);

-- A member's payslip for a month, in cents: gross pay, the employee's
-- contributions, the employer's, and net pay; and the time they worked,
-- in minutes, where their month was timed.
CREATE TABLE payslip.payslip (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  month text NOT NULL REFERENCES payslip.run,
  member text NOT NULL,
  minutes integer CHECK (minutes >= 0),
  gross cella.amount NOT NULL,
  employee cella.amount NOT NULL,
  employer cella.amount NOT NULL,
  net cella.amount NOT NULL,
  PRIMARY KEY (month, member),
  CHECK (cella.cents(gross) = cella.cents(employee) + cella.cents(net))
);

-- The first day of a month, and the first after it.
CREATE FUNCTION payslip.first(month text) RETURNS date
LANGUAGE sql IMMUTABLE
RETURN to_date(month || '-01', 'YYYY-MM-DD');

CREATE FUNCTION payslip.after(month text) RETURNS date
LANGUAGE sql IMMUTABLE
RETURN (to_date(month || '-01', 'YYYY-MM-DD') + interval '1 month')::date;

-- What each salaried member is due for a month: the salary in force on its
-- first day, and the contributions at the terms' rates, to the cent; a
-- salary that ended before the month is due nothing in it.
CREATE FUNCTION payslip.due(month text)
RETURNS TABLE (member text, gross bigint, employee bigint, employer bigint, net bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT s.member, s.gross,
         round(s.gross * t.employee / 100)::bigint,
         round(s.gross * t.employer / 100)::bigint,
         s.gross - round(s.gross * t.employee / 100)::bigint
  FROM (
    SELECT DISTINCT ON (x.member) x.member, x.until, cella.cents(x.gross) AS gross
    FROM payslip.salary x
    WHERE x."from" <= payslip.first(due.month)
    ORDER BY x.member, x."from" DESC
  ) s
  CROSS JOIN payslip.terms t
  WHERE s.until IS NULL OR s.until >= payslip.first(due.month);
END;

-- A run's payslips never change once it is approved, nor its approval and
-- payment once made.
CREATE FUNCTION payslip.stays() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'run' THEN
    IF OLD.approved IS NOT NULL AND (NEW.approved, NEW.approver) IS DISTINCT FROM (OLD.approved, OLD.approver) THEN
      RAISE EXCEPTION 'the % run was approved on %', OLD.month, OLD.approved
        USING ERRCODE = 'triggered_action_exception';
    END IF;
    IF OLD.paid IS NOT NULL THEN
      RAISE EXCEPTION 'the % run was paid on %', OLD.month, OLD.paid
        USING ERRCODE = 'triggered_action_exception';
    END IF;
    IF NEW.paid IS NOT NULL AND NEW.approved IS NULL THEN
      RAISE EXCEPTION 'the % run is not approved', OLD.month
        USING ERRCODE = 'triggered_action_exception';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT FROM payslip.run r WHERE r.month = coalesce(NEW.month, OLD.month) AND r.approved IS NOT NULL) THEN
    RAISE EXCEPTION 'the % run is approved: its payslips never change', coalesce(NEW.month, OLD.month)
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

CREATE TRIGGER stays BEFORE UPDATE ON payslip.run
  FOR EACH ROW EXECUTE FUNCTION payslip.stays();

-- A month has one run: a second is refused, whatever wrote it.
CREATE FUNCTION payslip.once() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM payslip.run r WHERE r.month = NEW.month) THEN
    RAISE EXCEPTION 'the % run was prepared on %', NEW.month, (SELECT r.generated FROM payslip.run r WHERE r.month = NEW.month)
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER once BEFORE INSERT ON payslip.run
  FOR EACH ROW EXECUTE FUNCTION payslip.once();
CREATE TRIGGER stays BEFORE INSERT OR UPDATE OR DELETE ON payslip.payslip
  FOR EACH ROW EXECUTE FUNCTION payslip.stays();

-- payslip:run:generate — the write prepared the month's run on the verdict
-- date, with exactly the payslips its salaried members are due.
CREATE FUNCTION payslip.generates(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.month IS NULL OR r.generated IS DISTINCT FROM cella.verdict_date() THEN coalesce(x.month, 'the month') || '''s run was not prepared by this write'
    WHEN NOT EXISTS (SELECT FROM payslip.due(x.month)) THEN x.month || ' has no salaried member'
    WHEN EXISTS (
      (SELECT d.member, d.gross, d.employee, d.employer, d.net FROM payslip.due(x.month) d)
      EXCEPT
      (SELECT p.member, cella.cents(p.gross), cella.cents(p.employee), cella.cents(p.employer), cella.cents(p.net) FROM payslip.payslip p WHERE p.month = x.month)
    ) OR EXISTS (
      (SELECT p.member, cella.cents(p.gross), cella.cents(p.employee), cella.cents(p.employer), cella.cents(p.net) FROM payslip.payslip p WHERE p.month = x.month)
      EXCEPT
      (SELECT d.member, d.gross, d.employee, d.employer, d.net FROM payslip.due(x.month) d)
    ) THEN x.month || '''s payslips are not what its salaried members are due'
  END
  FROM (SELECT payload ->> 'month' AS month) x
  LEFT JOIN payslip.run r ON r.month = x.month;
END;

-- Why a run's pay spreads wider than the coop's ratio between the highest
-- and the lowest gross salary, or NULL.
CREATE FUNCTION payslip.spread(month text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.top > s.bottom * t.ratio
      THEN spread.month || '''s highest salary, ' || s.top || ' cents, is more than ' || t.ratio || ' times its lowest, ' || s.bottom || ' cents'
  END
  FROM (
    SELECT max(cella.cents(p.gross)) AS top, min(cella.cents(p.gross)) AS bottom FROM payslip.payslip p WHERE p.month = spread.month
  ) s
  CROSS JOIN payslip.terms t;
END;

-- payslip:run:approve — the write approved a prepared run on the verdict
-- date, and its pay keeps within the coop's ratio.
CREATE FUNCTION payslip.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.month IS NULL THEN 'no run for ' || coalesce(x.month, 'the month')
    WHEN r.approved IS DISTINCT FROM cella.verdict_date() OR r.approver IS DISTINCT FROM cella.actor()
      THEN r.month || '''s run was not approved by this write'
    ELSE payslip.spread(r.month)
  END
  FROM (SELECT payload ->> 'month' AS month) x
  LEFT JOIN payslip.run r ON r.month = x.month;
END;

-- payslip:run:pay — the write paid an approved run on the verdict date.
CREATE FUNCTION payslip.pays(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.month IS NULL THEN 'no run for ' || coalesce(x.month, 'the month')
    WHEN r.paid IS DISTINCT FROM cella.verdict_date() THEN r.month || '''s run was not paid by this write'
  END
  FROM (SELECT payload ->> 'month' AS month) x
  LEFT JOIN payslip.run r ON r.month = x.month;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('payslip:run:generate', 'payslip.generates(jsonb)', 'payslip'),
  ('payslip:run:approve', 'payslip.approves(jsonb)', 'payslip'),
  ('payslip:run:pay', 'payslip.pays(jsonb)', 'payslip');

GRANT USAGE ON SCHEMA payslip TO cella_app, cella_guards;
GRANT SELECT ON ALL TABLES IN SCHEMA payslip TO cella_app, cella_guards;
GRANT INSERT ON payslip.run, payslip.payslip TO cella_app;
GRANT UPDATE (approved, approver, paid, generated) ON payslip.run TO cella_app;
GRANT UPDATE (minutes) ON payslip.payslip TO cella_app;
