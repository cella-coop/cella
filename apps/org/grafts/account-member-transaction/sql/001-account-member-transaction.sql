CREATE SCHEMA account_member_transaction;

-- What a member subscribed on joining: their capital account, the shares
-- and the entry that posted them.
CREATE TABLE account_member_transaction.subscription (
  member text PRIMARY KEY,
  account text NOT NULL UNIQUE,
  shares integer NOT NULL CHECK (shares > 0),
  entry text NOT NULL UNIQUE
);

-- What a member drew on their account, and the entry that paid it.
CREATE TABLE account_member_transaction.draw (
  entry text PRIMARY KEY,
  member text NOT NULL,
  amount cella.amount NOT NULL
);

CREATE INDEX ON account_member_transaction.draw (member);

-- A member admitted subscribes their shares, in the write that admits
-- them, whichever it is: their capital account is opened under 1013, next
-- in the chart, and what they owe for their shares at the share's value is
-- posted, 4561 debited and their capital credited, on the verdict date.
-- Paying it in is money received, which posts through a write of its own.
-- The books never hold an admission back: where the share has no value,
-- or the verdict date's period is not open, the admission settles and
-- nothing is subscribed.
CREATE FUNCTION account_member_transaction.subscribes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  code text;
  cents bigint;
  entry text;
BEGIN
  IF NOT (OLD.status = 'invited' AND NEW.status = 'active') OR NEW.shares = 0 THEN
    RETURN NULL;
  END IF;
  SELECT NEW.shares * cella.cents(t.share) INTO cents FROM account_member.terms t;
  IF cents IS NULL OR NOT EXISTS (
    SELECT FROM account.period p WHERE p.month = to_char(cella.verdict_date(), 'YYYY-MM') AND p.closed IS NULL
  ) OR NOT EXISTS (SELECT FROM account.account a WHERE a.code = '1013')
    OR NOT EXISTS (SELECT FROM account.account a WHERE a.code = '4561') THEN
    RETURN NULL;
  END IF;
  SELECT '1013' || lpad((coalesce(max(substr(a.code, 5)::integer), 0) + 1)::text, 2, '0') INTO code
  FROM account.account a WHERE a.parent = '1013' AND a.code ~ '^1013[0-9]{2}$';
  INSERT INTO account.account (code, label, kind, parent, holder)
  VALUES (code, 'Capital — ' || NEW.name, 'equity', '1013', NEW.address);
  INSERT INTO transaction.entry (date, label, receipt)
  VALUES (cella.verdict_date(), 'Capital subscribed, ' || code, cella.receipt())
  RETURNING id INTO entry;
  INSERT INTO transaction.line (entry, n, account, side, amount) VALUES
    (entry, 1, '4561', 'debit', cella.amount(cents)),
    (entry, 2, code, 'credit', cella.amount(cents));
  INSERT INTO account_member_transaction.subscription (member, account, shares, entry)
  VALUES (NEW.address, code, NEW.shares, entry);
  RETURN NULL;
END
$$;

CREATE TRIGGER subscribes AFTER UPDATE OF status ON member.member
  FOR EACH ROW EXECUTE FUNCTION account_member_transaction.subscribes();

-- What each member drew, and what is left of their draw limit.
CREATE VIEW account_member_transaction.drawn AS
SELECT c.member, c.account, c.frozen, c.allowance,
       coalesce((SELECT sum(cella.cents(d.amount)) FROM account_member_transaction.draw d WHERE d.member = c.member), 0) AS drawn
FROM account_member.capital c;

-- account:account:draw — a member draws on their own account, while they
-- are active and it is not frozen, within what is left of their draw
-- limit; the entry is exactly the draw: 455 debited and the bank, 512,
-- credited by its amount.
CREATE FUNCTION account_member_transaction.draws(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN x.member IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may draw only on their own account, not ' || coalesce(x.member, 'no one') || '''s'
    WHEN m.status IS DISTINCT FROM 'active' THEN x.member || ' is ' || coalesce(m.status, 'no member') || ': only an active member draws'
    WHEN w.account IS NULL THEN x.member || ' holds no capital account'
    WHEN w.frozen THEN w.account || ' is frozen: ' || x.member || ' left, and draws nothing until it is repaid'
    WHEN w.allowance IS NULL OR w.drawn > w.allowance
      THEN 'a draw of ' || x.amount || ' cents exceeds what is left of ' || x.member || '''s draw limit, '
        || greatest(coalesce(w.allowance, 0) - w.drawn + x.amount, 0) || ' of ' || coalesce(w.allowance, 0) || ' cents'
    WHEN (
      SELECT count(*) FILTER (WHERE NOT ((l.account = '455' AND l.side = 'debit') OR (l.account = '512' AND l.side = 'credit'))) <> 0
        OR count(*) <> 2 OR count(DISTINCT l.account) <> 2 OR bool_or(cella.cents(l.amount) <> x.amount)
      FROM transaction.line l WHERE l.entry = x.entry
    ) OR NOT EXISTS (SELECT FROM account_member_transaction.draw d WHERE d.entry = x.entry AND d.member = x.member)
      THEN coalesce(x.entry, 'the entry') || ' is not a draw of ' || x.amount || ' cents: 455 debited and 512 credited by it, nothing else'
  END
  FROM (SELECT payload ->> 'member' AS member, (payload ->> 'amount')::bigint AS amount, payload ->> 'entry' AS entry) x
  LEFT JOIN member.member m ON m.address = x.member
  LEFT JOIN account_member_transaction.drawn w ON w.member = x.member;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('account:account:draw', 'account_member_transaction.draws(jsonb)', 'account-member-transaction');

GRANT USAGE ON SCHEMA account_member_transaction TO cella_app, cella_rules;
GRANT SELECT ON account_member_transaction.subscription, account_member_transaction.draw, account_member_transaction.drawn TO cella_app, cella_rules;
GRANT INSERT ON account_member_transaction.subscription, account_member_transaction.draw TO cella_app;
