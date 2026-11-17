CREATE SCHEMA expense;

CREATE SEQUENCE expense.number;

-- What a member spent for the co-op from their own pocket, to be paid back:
-- the day, what it was for, the account of class 6 it is charged to, the
-- amount before VAT and the deductible VAT, and the receipt, a reference
-- until files are stored. Its member is an address, as text; that it is a
-- member's is the expense-membership graft's. The label is the member's own
-- words and stays out of the log.
CREATE TABLE expense.expense (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY DEFAULT 'ex-' || to_char(nextval('expense.number'), 'FM9999999999999990000'),
  member text NOT NULL,
  day date NOT NULL,
  label text NOT NULL CHECK (label <> ''),
  category text NOT NULL CHECK (category ~ '^6[0-9]+$'),
  net cella.amount NOT NULL,
  vat cella.amount,
  receipt text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'refused', 'reimbursed')),
  submitted date,
  decided date,
  decider text,
  reimbursed date,
  CHECK ((decided IS NULL) = (decider IS NULL)),
  CHECK ((status IN ('approved', 'refused', 'reimbursed')) = (decided IS NOT NULL)),
  CHECK ((status = 'reimbursed') = (reimbursed IS NOT NULL))
);

CREATE INDEX ON expense.expense (member);
CREATE INDEX ON expense.expense (decider, decided);

-- What it comes to, VAT included, in cents.
CREATE FUNCTION expense.total(e expense.expense) RETURNS bigint
LANGUAGE sql IMMUTABLE
RETURN cella.cents(e.net) + coalesce(cella.cents(e.vat), 0);

-- An expense moves only along its lifecycle: drafted, submitted, then
-- approved and reimbursed, or refused; anything else is refused whatever
-- wrote it, and its figures never change once submitted.
CREATE FUNCTION expense.moves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> OLD.status AND (OLD.status, NEW.status) NOT IN (
    ('draft', 'submitted'), ('submitted', 'approved'), ('submitted', 'refused'), ('approved', 'reimbursed')
  ) THEN
    RAISE EXCEPTION '% is %, and cannot become %', OLD.id, OLD.status, NEW.status
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.status <> 'draft' AND (expense.total(NEW), cella.cents(NEW.vat), NEW.category, NEW.day, NEW.member)
    IS DISTINCT FROM (expense.total(OLD), cella.cents(OLD.vat), OLD.category, OLD.day, OLD.member) THEN
    RAISE EXCEPTION '% was submitted: its figures never change', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  -- Each step is taken once: a second approval, refusal or reimbursement
  -- of the same expense is refused.
  IF NEW.status = OLD.status AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION '% is % already', OLD.id, OLD.status
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

-- It fires by the columns an update sets, every one but the body, which
-- `006-body.sql` adds, not by the values it changes: approving,
-- refusing or reimbursing an expense a second time sets its status to
-- the one it holds, and is refused as "already". A column
-- `expense.expense` gains is added to its list.
CREATE TRIGGER moves BEFORE UPDATE OF circle, id, member, day, label, category, net, vat, receipt, status, submitted, decided, decider, reimbursed ON expense.expense
  FOR EACH ROW EXECUTE FUNCTION expense.moves();

-- expense:expense:capture — an expense is the actor's own, spent on a day
-- that has come.
CREATE FUNCTION expense.captures(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no expense ' || coalesce(x.expense, 'is named')
    WHEN e.member IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may not claim an expense for ' || e.member
    WHEN e.day > cella.verdict_date() THEN 'an expense on ' || e.day::text || ' is in the future'
  END
  FROM (SELECT payload ->> 'expense' AS expense) x
  LEFT JOIN expense.expense e ON e.id = x.expense;
END;

-- expense:expense:submit — a member submits their own expense, on the
-- verdict date.
CREATE FUNCTION expense.submits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no expense ' || coalesce(x.expense, 'is named')
    WHEN e.member IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may not submit ' || e.member || '''s expense'
    WHEN e.status <> 'submitted' OR e.submitted IS DISTINCT FROM cella.verdict_date() THEN e.id || ' was not submitted by this write'
  END
  FROM (SELECT payload ->> 'expense' AS expense) x
  LEFT JOIN expense.expense e ON e.id = x.expense;
END;

-- expense:expense:approve and :refuse — the write decided a submitted
-- expense on the verdict date, as someone other than its member, for the
-- amount the payload names, so a mandate's limit caps what was approved.
CREATE FUNCTION expense.decides(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no expense ' || coalesce(x.expense, 'is named')
    WHEN e.status <> x.status OR e.decided IS DISTINCT FROM cella.verdict_date() OR e.decider IS DISTINCT FROM cella.actor()
      THEN e.id || ' was not ' || x.status || ' by this write'
    WHEN e.decider = e.member THEN e.member || ' may not decide their own expense'
    WHEN x.amount IS DISTINCT FROM expense.total(e) THEN e.id || ' comes to ' || expense.total(e) || ' cents, not ' || coalesce(x.amount::text, 'no amount')
  END
  FROM (
    SELECT payload ->> 'expense' AS expense, (payload ->> 'amount')::bigint AS amount,
           CASE cella.action() WHEN 'expense:expense:refuse' THEN 'refused' ELSE 'approved' END AS status
  ) x
  LEFT JOIN expense.expense e ON e.id = x.expense;
END;

-- expense:expense:reimburse — the write reimbursed an approved expense on
-- the verdict date, for its whole amount.
CREATE FUNCTION expense.reimburses(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no expense ' || coalesce(x.expense, 'is named')
    WHEN e.status <> 'reimbursed' OR e.reimbursed IS DISTINCT FROM cella.verdict_date() THEN e.id || ' was not reimbursed by this write'
    WHEN x.amount IS DISTINCT FROM expense.total(e) THEN e.id || ' comes to ' || expense.total(e) || ' cents, not ' || coalesce(x.amount::text, 'no amount')
  END
  FROM (SELECT payload ->> 'expense' AS expense, (payload ->> 'amount')::bigint AS amount) x
  LEFT JOIN expense.expense e ON e.id = x.expense;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('expense:expense:capture', 'expense.captures(jsonb)', 'expense'),
  ('expense:expense:submit', 'expense.submits(jsonb)', 'expense'),
  ('expense:expense:approve', 'expense.decides(jsonb)', 'expense'),
  ('expense:expense:refuse', 'expense.decides(jsonb)', 'expense'),
  ('expense:expense:reimburse', 'expense.reimburses(jsonb)', 'expense');

GRANT USAGE ON SCHEMA expense TO cella_app, cella_guards;
GRANT SELECT ON expense.expense TO cella_app, cella_guards;
GRANT INSERT, UPDATE ON expense.expense TO cella_app;
GRANT USAGE ON SEQUENCE expense.number TO cella_app;
