-- Capital paid in and paid out, on the PCG's accounts (Règlement ANC n°
-- 2014-03, class 1 and 456, as the PCG's account list gives them; the
-- regulation's text is not verified on Légifrance, which refuses the box).
-- A SCOP's capital is variable and called whole when it is subscribed, so
-- a subscription is capital subscribed and called but not paid: 4562
-- (Apporteurs, capital appelé non versé) debited and 1012 (Capital
-- souscrit, appelé, non versé) credited. Each payment is money received,
-- 4562 credited, and moves what it pays from 1012 to the associate's own
-- account under 1013 (Capital souscrit, appelé, versé). An associate who
-- leaves has their paid-up capital moved to 4567 (Associés, capital à
-- rembourser), what they had not paid cancelled, and the repayments the
-- statutes set drawn up; each repayment pays 4567 from the bank.

-- What a subscription cost, the shares at the share's value on the day,
-- and what of it the exit cancelled, unpaid.
ALTER TABLE account_member_transaction.subscription
  ADD COLUMN amount cella.amount,
  ADD COLUMN cancelled cella.amount;

-- What an associate paid in on their subscription, the entry that posted
-- it and how: from the bank, or withheld from their pay.
CREATE TABLE account_member_transaction.paid (
  entry text NOT NULL,
  member text NOT NULL,
  amount cella.amount NOT NULL,
  via text NOT NULL CHECK (via IN ('bank', 'pay')),
  PRIMARY KEY (entry, member)
);

CREATE INDEX ON account_member_transaction.paid (member);

-- Each subscription: what it cost, what is paid, what the exit cancelled
-- and what is left to pay.
CREATE VIEW account_member_transaction.called AS
SELECT s.member, s.account, s.shares, cella.cents(s.amount) AS amount,
       coalesce(p.paid, 0) AS paid, coalesce(cella.cents(s.cancelled), 0) AS cancelled,
       cella.cents(s.amount) - coalesce(p.paid, 0) - coalesce(cella.cents(s.cancelled), 0) AS unpaid
FROM account_member_transaction.subscription s
LEFT JOIN (
  SELECT d.member, sum(cella.cents(d.amount))::bigint AS paid FROM account_member_transaction.paid d GROUP BY d.member
) p ON p.member = s.member
WHERE s.amount IS NOT NULL;

-- A member admitted subscribes their shares, in the write that admits
-- them, whichever it is: their capital account opens under 1013, next in
-- the chart, and their shares at the share's value are called, 4562
-- debited and 1012 credited, on the verdict date; the account under 1013
-- holds what they pay in. The statutes' minimum refuses a smaller
-- subscription. The books never hold an admission back otherwise: where
-- no adopted terms value a share, or the verdict date's period is not
-- open, the admission settles and nothing is subscribed.
CREATE OR REPLACE FUNCTION account_member_transaction.subscribes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  terms text;
  code text;
  cents bigint;
  fewest integer;
  entry text;
BEGIN
  IF NOT (OLD.status = 'invited' AND NEW.status = 'active') OR NEW.shares = 0 THEN
    RETURN NULL;
  END IF;
  terms := account.capital_for(cella.verdict_date());
  SELECT NEW.shares * cella.cents(t.share), t.minimum INTO cents, fewest FROM account.terms t WHERE t.id = terms;
  IF cents IS NULL OR NOT EXISTS (
    SELECT FROM account.period p WHERE p.month = to_char(cella.verdict_date(), 'YYYY-MM') AND p.closed IS NULL
  ) OR NOT EXISTS (SELECT FROM account.account a WHERE a.code = '1013')
    OR NOT EXISTS (SELECT FROM account.account a WHERE a.code = '1012')
    OR NOT EXISTS (SELECT FROM account.account a WHERE a.code = '4562') THEN
    RETURN NULL;
  END IF;
  IF NEW.shares < fewest THEN
    RAISE EXCEPTION '% subscribes % shares: % ask at least %', NEW.address, NEW.shares, terms, fewest
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT '1013' || lpad((coalesce(max(substr(a.code, 5)::integer), 0) + 1)::text, 2, '0') INTO code
  FROM account.account a WHERE a.parent = '1013' AND a.code ~ '^1013[0-9]{2}$';
  INSERT INTO account.account (code, label, kind, parent, holder)
  VALUES (code, 'Capital — ' || NEW.name, 'equity', '1013', NEW.address);
  INSERT INTO transaction.entry (date, label, receipt)
  VALUES (cella.verdict_date(), 'Capital subscribed and called, ' || code, cella.receipt())
  RETURNING id INTO entry;
  INSERT INTO transaction.line (entry, n, account, side, amount) VALUES
    (entry, 1, '4562', 'debit', cella.amount(cents)),
    (entry, 2, '1012', 'credit', cella.amount(cents));
  INSERT INTO account_member_transaction.subscription (member, account, shares, entry, amount)
  VALUES (NEW.address, code, NEW.shares, entry, cella.amount(cents));
  RETURN NULL;
END
$$;

-- The lines a payment in posts: the money received against 4562, and
-- what it pays moved from 1012 to the associate's capital account.
CREATE FUNCTION account_member_transaction.paying(capital text, paid bigint)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT x.code, x.side, paying.paid
  FROM (VALUES ('512', 'debit', 1), ('4562', 'credit', 2), ('1012', 'debit', 3), (paying.capital, 'credit', 4)) x (code, side, n)
  ORDER BY x.n;
END;

-- account:capital:pay — an associate pays in on their subscription from
-- the bank, never more than they owe, and the entry is exactly that.
CREATE FUNCTION account_member_transaction.pays(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.member IS NULL THEN coalesce(x.member, 'no one') || ' has no subscription to pay'
    WHEN c.unpaid < 0
      THEN 'a payment of ' || x.amount || ' cents exceeds what ' || x.member || ' owes on their subscription, '
        || (c.unpaid + x.amount) || ' cents'
    WHEN NOT EXISTS (
      SELECT FROM account_member_transaction.paid d
      WHERE d.entry = x.entry AND d.member = x.member AND d.via = 'bank' AND cella.cents(d.amount) = x.amount
    ) OR EXISTS (
      (SELECT p.account, p.side, p.cents FROM account_member_transaction.paying(c.account, x.amount) p)
      EXCEPT ALL
      (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = x.entry)
    ) OR EXISTS (
      (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = x.entry)
      EXCEPT ALL
      (SELECT p.account, p.side, p.cents FROM account_member_transaction.paying(c.account, x.amount) p)
    ) THEN coalesce(x.entry, 'the entry') || ' is not a payment of ' || x.amount || ' cents on ' || x.member
      || '''s subscription: 512 debited and 4562 credited, 1012 debited and ' || c.account || ' credited, nothing else'
  END
  FROM (SELECT payload ->> 'member' AS member, (payload ->> 'amount')::bigint AS amount, payload ->> 'entry' AS entry) x
  LEFT JOIN account_member_transaction.called c ON c.member = x.member;
END;

-- What a departed associate is repaid of their capital: each repayment
-- by its number, the day it falls due, its amount, and the entry and day
-- that paid it. A repayment paid never changes.
CREATE TABLE account_member_transaction.repayment (
  member text NOT NULL,
  n integer NOT NULL CHECK (n > 0),
  due date NOT NULL,
  amount cella.amount NOT NULL,
  entry text,
  paid date,
  PRIMARY KEY (member, n),
  CHECK ((entry IS NULL) = (paid IS NULL))
);

CREATE FUNCTION account_member_transaction.stays_repaid() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.paid IS NOT NULL THEN
    RAISE EXCEPTION '%''s repayment % was paid on %', OLD.member, OLD.n, OLD.paid
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

CREATE TRIGGER stays_repaid BEFORE UPDATE OR DELETE ON account_member_transaction.repayment
  FOR EACH ROW EXECUTE FUNCTION account_member_transaction.stays_repaid();

-- An associate who leaves, in the write that ends their membership,
-- whichever it is: what their capital accounts hold moves to 4567, owed
-- them, what they had not paid of their subscription is cancelled, 1012
-- debited and 4562 credited, and their repayments are drawn up as the
-- statutes' clauses governing the exit say, the capital divided evenly
-- among them to the cent. As with a subscription, the books never hold
-- an exit back: with no clauses, no open period or no 4567, the capital
-- stays frozen where it is and nothing is drawn up.
CREATE FUNCTION account_member_transaction.withdraws() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  terms text;
  held bigint;
  owed bigint;
  entry text;
BEGIN
  IF NOT (NEW.status = 'exited' AND OLD.status <> 'exited') THEN
    RETURN NULL;
  END IF;
  terms := account.capital_for(cella.verdict_date());
  SELECT coalesce(sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END), 0)
  INTO held
  FROM transaction.line l JOIN account.account a ON a.code = l.account
  WHERE a.holder = NEW.address AND a.parent = '1013';
  SELECT greatest(c.unpaid, 0) INTO owed FROM account_member_transaction.called c WHERE c.member = NEW.address;
  owed := coalesce(owed, 0);
  IF terms IS NULL OR (held <= 0 AND owed = 0) OR NOT EXISTS (
    SELECT FROM account.period p WHERE p.month = to_char(cella.verdict_date(), 'YYYY-MM') AND p.closed IS NULL
  ) OR NOT EXISTS (SELECT FROM account.account a WHERE a.code = '4567') THEN
    RETURN NULL;
  END IF;
  INSERT INTO transaction.entry (date, label, receipt)
  VALUES (cella.verdict_date(), 'Capital to repay, ' || NEW.address, cella.receipt())
  RETURNING id INTO entry;
  INSERT INTO transaction.line (entry, n, account, side, amount)
  SELECT entry, row_number() OVER (ORDER BY y.n), y.account, y.side, cella.amount(y.cents)
  FROM (
    SELECT 1 AS n, a.code AS account, 'debit' AS side, b.cents
    FROM account.account a
    JOIN LATERAL (
      SELECT coalesce(sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END), 0)::bigint AS cents
      FROM transaction.line l WHERE l.account = a.code
    ) b ON b.cents > 0
    WHERE a.holder = NEW.address AND a.parent = '1013' AND held > 0
    UNION ALL SELECT 2, '4567', 'credit', held WHERE held > 0
    UNION ALL SELECT 3, '1012', 'debit', owed WHERE owed > 0
    UNION ALL SELECT 4, '4562', 'credit', owed WHERE owed > 0
  ) y;
  IF owed > 0 THEN
    UPDATE account_member_transaction.subscription SET cancelled = cella.amount(owed) WHERE member = NEW.address;
  END IF;
  IF held > 0 THEN
    INSERT INTO account_member_transaction.repayment (member, n, due, amount)
    SELECT NEW.address, r.n, r.due, cella.amount((cella.allocate(cella.amount(held), array_fill(1::bigint, ARRAY[t.repayments])))[r.n])
    FROM account.repayments(terms, cella.verdict_date()) r
    CROSS JOIN account.terms t WHERE t.id = terms;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER withdraws AFTER UPDATE OF status ON member.member
  FOR EACH ROW EXECUTE FUNCTION account_member_transaction.withdraws();

-- account:capital:repay — a departed associate's repayment, paid by this
-- write once it has fallen due and after every one before it, and the
-- entry is exactly it: 4567 debited and the bank, 512, credited.
CREATE FUNCTION account_member_transaction.repays(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.member IS NULL THEN coalesce(x.member, 'no one') || ' has no repayment ' || coalesce(x.n::text, '')
    WHEN r.entry IS DISTINCT FROM x.entry
      THEN x.member || '''s repayment ' || x.n || ' was paid on ' || coalesce(r.paid::text, 'another day') || ' by ' || coalesce(r.entry, 'another write')
    WHEN r.due > cella.verdict_date() THEN x.member || '''s repayment ' || x.n || ' falls due on ' || r.due
    WHEN EXISTS (SELECT FROM account_member_transaction.repayment e WHERE e.member = x.member AND e.n < x.n AND e.paid IS NULL)
      THEN x.member || '''s repayment ' || (SELECT min(e.n) FROM account_member_transaction.repayment e WHERE e.member = x.member AND e.paid IS NULL) || ' comes first'
    WHEN (
      SELECT count(*) FILTER (WHERE NOT ((l.account = '4567' AND l.side = 'debit') OR (l.account = '512' AND l.side = 'credit'))) <> 0
        OR count(*) <> 2 OR count(DISTINCT l.account) <> 2 OR bool_or(cella.cents(l.amount) <> cella.cents(r.amount))
      FROM transaction.line l WHERE l.entry = x.entry
    ) THEN coalesce(x.entry, 'the entry') || ' is not ' || x.member || '''s repayment ' || x.n || ' of ' || cella.cents(r.amount)
      || ' cents: 4567 debited and 512 credited by it, nothing else'
  END
  FROM (SELECT payload ->> 'member' AS member, (payload ->> 'n')::integer AS n, payload ->> 'entry' AS entry) x
  LEFT JOIN account_member_transaction.repayment r ON r.member = x.member AND r.n = x.n;
END;

-- What each departed associate is owed: their repayments, paid and due.
CREATE VIEW account_member_transaction.owed AS
SELECT r.member, count(*)::integer AS repayments,
       sum(cella.cents(r.amount))::bigint AS amount,
       coalesce(sum(cella.cents(r.amount)) FILTER (WHERE r.paid IS NOT NULL), 0)::bigint AS repaid,
       coalesce(sum(cella.cents(r.amount)) FILTER (WHERE r.paid IS NULL), 0)::bigint AS left,
       min(r.due) FILTER (WHERE r.paid IS NULL) AS next
FROM account_member_transaction.repayment r
GROUP BY r.member;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('account:capital:pay', 'account_member_transaction.pays(jsonb)', 'account-member-transaction'),
  ('account:capital:repay', 'account_member_transaction.repays(jsonb)', 'account-member-transaction');

GRANT SELECT ON account_member_transaction.paid, account_member_transaction.called,
  account_member_transaction.repayment, account_member_transaction.owed TO cella_app, cella_rules;
GRANT INSERT ON account_member_transaction.paid, account_member_transaction.repayment TO cella_app;
GRANT UPDATE (amount, cancelled) ON account_member_transaction.subscription TO cella_app;
GRANT UPDATE (entry, paid) ON account_member_transaction.repayment TO cella_app;
