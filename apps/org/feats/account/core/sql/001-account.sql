CREATE SCHEMA account;

-- The chart of accounts. A code is unique in the scope; a balance is never
-- stored, it is summed from the journal through the account-transaction
-- graft.
CREATE TABLE account.account (
  code text PRIMARY KEY CHECK (code ~ '^[0-9]+$'),
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('asset', 'liability', 'equity', 'income', 'expense')),
  parent text REFERENCES account.account,
  -- A capital account's member, by address, as text.
  holder text,
  frozen boolean NOT NULL DEFAULT false
);

-- A month of the books, open until closed, never reopened.
CREATE TABLE account.period (
  month text PRIMARY KEY CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  closed date
);

-- The first day after a period.
CREATE FUNCTION account.period_end(month text) RETURNS date
LANGUAGE sql IMMUTABLE
RETURN (to_date(month, 'YYYY-MM') + interval '1 month')::date;

-- A closed period stays closed, and closes once.
CREATE FUNCTION account.stays_closed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.closed IS NOT NULL THEN
    RAISE EXCEPTION '% closed on %', OLD.month, OLD.closed
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_closed BEFORE UPDATE ON account.period
  FOR EACH ROW EXECUTE FUNCTION account.stays_closed();

-- account:period:close — the write closed the period on the verdict date,
-- after it ended, and after the period before it.
CREATE FUNCTION account.closes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.month IS NULL THEN 'no period ' || coalesce(x.month, 'is named')
    WHEN p.closed IS DISTINCT FROM cella.verdict_date() THEN p.month || ' was not closed by this write'
    WHEN p.closed < account.period_end(p.month) THEN p.month || ' runs until ' || to_char(account.period_end(p.month) - 1, 'YYYY-MM-DD')
    WHEN EXISTS (SELECT FROM account.period q WHERE q.month < p.month AND q.closed IS NULL)
      THEN p.month || ' closes after ' || (SELECT min(q.month) FROM account.period q WHERE q.month < p.month AND q.closed IS NULL)
  END
  FROM (SELECT payload ->> 'month' AS month) x
  LEFT JOIN account.period p ON p.month = x.month;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('account:period:close', 'account.closes(jsonb)', 'account');

GRANT USAGE ON SCHEMA account TO cella_app, cella_rules;
GRANT SELECT ON ALL TABLES IN SCHEMA account TO cella_app, cella_rules;
GRANT UPDATE (closed) ON account.period TO cella_app;
