CREATE SCHEMA account_transaction;

-- Every line posts to an account of the chart, and no entry posts into a
-- closed period, whichever write posts it: a transaction's own, or an
-- invoice's through invoice-transaction. The period row is read FOR SHARE
-- and `account:period:close` updates it, so a post and a concurrent close
-- are serialised: the close waits for the post, or the post sees the close.
CREATE FUNCTION account_transaction.posts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  day date;
  period text;
  closed date;
BEGIN
  IF NOT EXISTS (SELECT FROM account.account a WHERE a.code = NEW.account) THEN
    RAISE EXCEPTION '% posts to %, which is no account', NEW.entry, NEW.account
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT e.date INTO day FROM transaction.entry e WHERE e.id = NEW.entry;
  period := to_char(day, 'YYYY-MM');
  SELECT p.closed INTO closed FROM account.period p WHERE p.month = period FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '% is dated %, in no period of the books', NEW.entry, day
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF closed IS NOT NULL THEN
    RAISE EXCEPTION '% is closed: % cannot post into it', period, NEW.entry
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER posts BEFORE INSERT ON transaction.line
  FOR EACH ROW EXECUTE FUNCTION account_transaction.posts();

-- The trial balance: each account's debits and credits from the journal,
-- in cents; `balance` is signed, debit positive.
CREATE VIEW account_transaction.balance AS
SELECT a.code, a.label, a.kind,
       coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'debit'), 0) AS debit,
       coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'credit'), 0) AS credit,
       coalesce(sum(CASE l.side WHEN 'debit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END), 0) AS balance
FROM account.account a
LEFT JOIN transaction.line l ON l.account = a.code
GROUP BY a.code, a.label, a.kind;

GRANT USAGE ON SCHEMA account_transaction TO cella_app, cella_guards;
GRANT SELECT ON account_transaction.balance TO cella_app, cella_guards;
