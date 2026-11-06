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
ALTER TABLE account_membership_transaction.subscription
  ADD COLUMN amount cella.amount,
  ADD COLUMN cancelled cella.amount;

-- What an associate paid in on their subscription, the entry that posted
-- it and how: from the bank, or withheld from their pay.
CREATE TABLE account_membership_transaction.paid (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  entry text NOT NULL,
  member text NOT NULL,
  amount cella.amount NOT NULL,
  via text NOT NULL CHECK (via IN ('bank', 'pay')),
  PRIMARY KEY (entry, member)
);

CREATE INDEX ON account_membership_transaction.paid (member);

-- Records a payment in its entry posted: this graft's published write of
-- `paid`, by which a graft above records one in the write that posts it,
-- as an instalment withheld from a member's pay, and never inserts the
-- row itself.
CREATE FUNCTION account_membership_transaction.pay_in(entry text, member text, amount cella.amount, via text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO account_membership_transaction.paid (entry, member, amount, via)
  VALUES (pay_in.entry, pay_in.member, pay_in.amount, pay_in.via);
END;

-- Each subscription: what it cost, what is paid, what the exit cancelled
-- and what is left to pay.
CREATE VIEW account_membership_transaction.called AS
SELECT s.member, s.account, s.shares, cella.cents(s.amount) AS amount,
       coalesce(p.paid, 0) AS paid, coalesce(cella.cents(s.cancelled), 0) AS cancelled,
       cella.cents(s.amount) - coalesce(p.paid, 0) - coalesce(cella.cents(s.cancelled), 0) AS unpaid
FROM account_membership_transaction.subscription s
LEFT JOIN (
  SELECT d.member, sum(cella.cents(d.amount))::bigint AS paid FROM account_membership_transaction.paid d GROUP BY d.member
) p ON p.member = s.member
WHERE s.amount IS NOT NULL;

-- The lines a payment in posts: the money received against 4562, and
-- what it pays moved from 1012 to the associate's capital account.
CREATE FUNCTION account_membership_transaction.paying(capital text, paid bigint)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql IMMUTABLE
BEGIN ATOMIC
  SELECT x.code, x.side, paying.paid
  FROM (VALUES ('512', 'debit', 1), ('4562', 'credit', 2), ('1012', 'debit', 3), (paying.capital, 'credit', 4)) x (code, side, n)
  ORDER BY x.n;
END;

-- account:capital:pay — an associate pays in on their subscription from
-- the bank, never more than they owe, and the entry is exactly that.
CREATE FUNCTION account_membership_transaction.pays(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.member IS NULL THEN coalesce(x.member, 'no one') || ' has no subscription to pay'
    WHEN c.unpaid < 0
      THEN 'a payment of ' || x.amount || ' cents exceeds what ' || x.member || ' owes on their subscription, '
        || (c.unpaid + x.amount) || ' cents'
    WHEN NOT EXISTS (
      SELECT FROM account_membership_transaction.paid d
      WHERE d.entry = x.entry AND d.member = x.member AND d.via = 'bank' AND cella.cents(d.amount) = x.amount
    ) OR EXISTS (
      (SELECT p.account, p.side, p.cents FROM account_membership_transaction.paying(c.account, x.amount) p)
      EXCEPT ALL
      (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = x.entry)
    ) OR EXISTS (
      (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = x.entry)
      EXCEPT ALL
      (SELECT p.account, p.side, p.cents FROM account_membership_transaction.paying(c.account, x.amount) p)
    ) THEN coalesce(x.entry, 'the entry') || ' is not a payment of ' || x.amount || ' cents on ' || x.member
      || '''s subscription: 512 debited and 4562 credited, 1012 debited and ' || c.account || ' credited, nothing else'
  END
  FROM (SELECT payload ->> 'member' AS member, (payload ->> 'amount')::bigint AS amount, payload ->> 'entry' AS entry) x
  LEFT JOIN account_membership_transaction.called c ON c.member = x.member;
END;

-- What a departed associate is repaid of their capital: each repayment
-- by its number, the day it falls due, its amount, and the entry and day
-- that paid it. A repayment paid never changes.
CREATE TABLE account_membership_transaction.repayment (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  member text NOT NULL,
  n integer NOT NULL CHECK (n > 0),
  due date NOT NULL,
  amount cella.amount NOT NULL,
  entry text,
  paid date,
  PRIMARY KEY (member, n),
  CHECK ((entry IS NULL) = (paid IS NULL))
);

CREATE FUNCTION account_membership_transaction.stays_repaid() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.paid IS NOT NULL THEN
    RAISE EXCEPTION '%''s repayment % was paid on %', OLD.member, OLD.n, OLD.paid
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

CREATE TRIGGER stays_repaid BEFORE UPDATE OR DELETE ON account_membership_transaction.repayment
  FOR EACH ROW EXECUTE FUNCTION account_membership_transaction.stays_repaid();

-- account:capital:repay — a departed associate's repayment, paid by this
-- write once it has fallen due and after every one before it, and the
-- entry is exactly it: 4567 debited and the bank, 512, credited.
CREATE FUNCTION account_membership_transaction.repays(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.member IS NULL THEN coalesce(x.member, 'no one') || ' has no repayment ' || coalesce(x.n::text, '')
    WHEN r.entry IS DISTINCT FROM x.entry
      THEN x.member || '''s repayment ' || x.n || ' was paid on ' || coalesce(r.paid::text, 'another day') || ' by ' || coalesce(r.entry, 'another write')
    WHEN r.due > cella.verdict_date() THEN x.member || '''s repayment ' || x.n || ' falls due on ' || r.due
    WHEN EXISTS (SELECT FROM account_membership_transaction.repayment e WHERE e.member = x.member AND e.n < x.n AND e.paid IS NULL)
      THEN x.member || '''s repayment ' || (SELECT min(e.n) FROM account_membership_transaction.repayment e WHERE e.member = x.member AND e.paid IS NULL) || ' comes first'
    WHEN (
      SELECT count(*) FILTER (WHERE NOT ((l.account = '4567' AND l.side = 'debit') OR (l.account = '512' AND l.side = 'credit'))) <> 0
        OR count(*) <> 2 OR count(DISTINCT l.account) <> 2 OR bool_or(cella.cents(l.amount) <> cella.cents(r.amount))
      FROM transaction.line l WHERE l.entry = x.entry
    ) THEN coalesce(x.entry, 'the entry') || ' is not ' || x.member || '''s repayment ' || x.n || ' of ' || cella.cents(r.amount)
      || ' cents: 4567 debited and 512 credited by it, nothing else'
  END
  FROM (SELECT payload ->> 'member' AS member, (payload ->> 'n')::integer AS n, payload ->> 'entry' AS entry) x
  LEFT JOIN account_membership_transaction.repayment r ON r.member = x.member AND r.n = x.n;
END;

-- What each departed associate is owed: their repayments, paid and due.
CREATE VIEW account_membership_transaction.owed AS
SELECT r.member, count(*)::integer AS repayments,
       sum(cella.cents(r.amount))::bigint AS amount,
       coalesce(sum(cella.cents(r.amount)) FILTER (WHERE r.paid IS NOT NULL), 0)::bigint AS repaid,
       coalesce(sum(cella.cents(r.amount)) FILTER (WHERE r.paid IS NULL), 0)::bigint AS left,
       min(r.due) FILTER (WHERE r.paid IS NULL) AS next
FROM account_membership_transaction.repayment r
GROUP BY r.member;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('account:capital:pay', 'account_membership_transaction.pays(jsonb)', 'account-membership-transaction'),
  ('account:capital:repay', 'account_membership_transaction.repays(jsonb)', 'account-membership-transaction');

GRANT SELECT ON account_membership_transaction.paid, account_membership_transaction.called,
  account_membership_transaction.repayment, account_membership_transaction.owed TO cella_app, cella_guards;
GRANT INSERT ON account_membership_transaction.paid, account_membership_transaction.repayment TO cella_app;
GRANT UPDATE (cancelled) ON account_membership_transaction.subscription TO cella_app;
GRANT UPDATE (entry, paid) ON account_membership_transaction.repayment TO cella_app;

-- account:capital:subscribe — a member admitted subscribes their shares,
-- by the write that follows their admission: they are active and hold
-- shares `account.subscribe_flaw` finds sound on the verdict date, at
-- least the minimum of the terms governing it, which value a share, its
-- month open; this write made their one subscription, of exactly their
-- shares at that value, on a capital account under 1013 they hold; and the
-- entry is exactly it, 4562 debited and 1012 credited. Its reasons name
-- no person: a subscription refused at a close is forgone, its reason in
-- the log.
CREATE FUNCTION account_membership_transaction.subscribes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'the subscriber is no member'
    WHEN m.status <> 'active' THEN 'the subscriber is ' || m.status || ': only a member admitted subscribes'
    WHEN m.shares = 0 THEN 'the subscriber holds no shares to subscribe'
    WHEN account.subscribe_flaw(m.shares, cella.verdict_date()) IS NOT NULL THEN account.subscribe_flaw(m.shares, cella.verdict_date())
    WHEN s.member IS NULL OR s.entry IS DISTINCT FROM x.entry OR s.account IS DISTINCT FROM x.account
      THEN coalesce(x.entry, 'the entry') || ' is not the member''s subscription'
    WHEN s.shares <> m.shares OR cella.cents(s.amount) IS DISTINCT FROM m.shares * cella.cents(t.share)
      THEN 'the subscription is not the member''s ' || m.shares || ' shares at ' || cella.cents(t.share) || ' cents each'
    WHEN NOT EXISTS (SELECT FROM account.account a WHERE a.code = s.account AND a.holder = m.address AND a.parent = '1013')
      THEN s.account || ' is no capital account of the member''s under 1013'
    WHEN (
      SELECT count(*) <> 2 OR count(DISTINCT l.account) <> 2 OR bool_or(cella.cents(l.amount) <> cella.cents(s.amount))
        OR count(*) FILTER (WHERE (l.account = '4562' AND l.side = 'debit') OR (l.account = '1012' AND l.side = 'credit')) <> 2
      FROM transaction.line l WHERE l.entry = x.entry
    ) THEN x.entry || ' is not a subscription of ' || cella.cents(s.amount) || ' cents: 4562 debited and 1012 credited by it, nothing else'
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'entry' AS entry, payload ->> 'account' AS account) x
  LEFT JOIN membership.member m ON m.address = x.member
  LEFT JOIN account.terms t ON t.id = account.capital_for(cella.verdict_date())
  LEFT JOIN account_membership_transaction.subscription s ON s.member = x.member;
END;

-- What an associate who leaves withdrew, once: the entry that moved their
-- capital to 4567 and cancelled what they had not paid.
CREATE TABLE account_membership_transaction.withdrawal (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  member text PRIMARY KEY,
  entry text NOT NULL UNIQUE
);

-- Whether the withdrawal that follows a member's exit has anything to do:
-- terms govern the verdict date, nothing is drawn up for them yet, and
-- their capital accounts hold something or they owe some of their
-- subscription. It runs as its owner, since whoever closed the motion may
-- read no colleague's capital, and says no more than whether.
CREATE FUNCTION account_membership_transaction.holds(member text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT account.capital_for(cella.verdict_date()) IS NOT NULL
    AND NOT EXISTS (SELECT FROM account_membership_transaction.withdrawal w WHERE w.member = holds.member)
    AND NOT EXISTS (SELECT FROM account_membership_transaction.repayment r WHERE r.member = holds.member)
    AND (
      EXISTS (SELECT FROM account_membership_transaction.called c WHERE c.member = holds.member AND c.unpaid > 0)
      OR coalesce((
        SELECT sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END)
        FROM transaction.line l JOIN account.account a ON a.code = l.account
        WHERE a.holder = holds.member AND a.parent = '1013'
      ), 0) > 0
    );
END;

REVOKE EXECUTE ON FUNCTION account_membership_transaction.holds(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION account_membership_transaction.holds(text) TO cella_app;

-- account:capital:withdraw, account:own:withdraw — an associate who left has their capital
-- withdrawn, by the write that follows their exit: this write made their
-- one withdrawal; their capital accounts hold nothing after it, what they
-- held credited to 4567; what they had not paid is cancelled, 1012 debited
-- and 4562 credited by what the subscription records cancelled; the entry
-- posts nothing else; and its repayments add up to what it credits 4567,
-- as many as the terms governing the exit say.
CREATE FUNCTION account_membership_transaction.withdraws(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN coalesce(x.member, 'no one') || ' is no member'
    WHEN m.status <> 'exited' THEN m.address || ' is ' || m.status || ': only the capital of a member who left is withdrawn'
    WHEN t.id IS NULL THEN 'no terms govern an exit on ' || cella.verdict_date()
    WHEN w.member IS NULL OR w.entry IS DISTINCT FROM x.entry THEN coalesce(x.entry, 'the entry') || ' is not ' || m.address || '''s withdrawal'
    WHEN EXISTS (
      SELECT FROM account.account a WHERE a.holder = m.address AND a.parent = '1013' AND coalesce((
        SELECT sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END) FROM transaction.line l WHERE l.account = a.code
      ), 0) <> 0
    ) THEN m.address || '''s capital accounts still hold capital after ' || x.entry
    WHEN EXISTS (SELECT FROM account_membership_transaction.called c WHERE c.member = m.address AND c.unpaid <> 0)
      THEN 'what ' || m.address || ' had not paid of their subscription is not cancelled'
    WHEN e.other OR e.cancelled IS DISTINCT FROM coalesce(cella.cents(s.cancelled), 0) OR e.uncalled IS DISTINCT FROM e.cancelled
      THEN x.entry || ' is not ' || m.address || '''s withdrawal: their capital accounts debited and 4567 credited, 1012 debited and 4562 credited by what is cancelled, nothing else'
    WHEN e.owed > 0 AND (
      (SELECT count(*) FROM account_membership_transaction.repayment r WHERE r.member = m.address) <> t.repayments
      OR (SELECT sum(cella.cents(r.amount)) FROM account_membership_transaction.repayment r WHERE r.member = m.address) <> e.owed
    ) THEN 'the repayments drawn up for ' || m.address || ' are not the ' || t.repayments || ' adding up to the ' || e.owed || ' cents ' || x.entry || ' owes them'
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'entry' AS entry) x
  LEFT JOIN membership.member m ON m.address = x.member
  LEFT JOIN account.terms t ON t.id = account.capital_for(cella.verdict_date())
  LEFT JOIN account_membership_transaction.withdrawal w ON w.member = x.member
  LEFT JOIN account_membership_transaction.subscription s ON s.member = x.member
  CROSS JOIN LATERAL (
    SELECT coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.account = '4567' AND l.side = 'credit'), 0) AS owed,
           coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.account = '1012' AND l.side = 'debit'), 0) AS cancelled,
           coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.account = '4562' AND l.side = 'credit'), 0) AS uncalled,
           coalesce(bool_or(NOT (
             (l.account = '4567' AND l.side = 'credit') OR (l.account = '1012' AND l.side = 'debit') OR (l.account = '4562' AND l.side = 'credit')
             OR (l.side = 'debit' AND EXISTS (SELECT FROM account.account a WHERE a.code = l.account AND a.holder = x.member AND a.parent = '1013'))
           )), false) AS other
    FROM transaction.line l WHERE l.entry = x.entry
  ) e;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('account:capital:subscribe', 'account_membership_transaction.subscribes(jsonb)', 'account-membership-transaction'),
  ('account:capital:withdraw', 'account_membership_transaction.withdraws(jsonb)', 'account-membership-transaction'),
  ('account:own:withdraw', 'account_membership_transaction.withdraws(jsonb)', 'account-membership-transaction');

GRANT SELECT ON account_membership_transaction.withdrawal TO cella_app, cella_guards;
GRANT INSERT ON account_membership_transaction.withdrawal TO cella_app;
