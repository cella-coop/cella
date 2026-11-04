CREATE SCHEMA account_membership_transaction;

-- What a member subscribed on joining: their capital account, the shares
-- and the entry that posted them.
CREATE TABLE account_membership_transaction.subscription (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  member text PRIMARY KEY,
  account text NOT NULL UNIQUE,
  shares integer NOT NULL CHECK (shares > 0),
  entry text NOT NULL UNIQUE
);

-- What a member drew on their account, and the entry that paid it.
CREATE TABLE account_membership_transaction.draw (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  entry text PRIMARY KEY,
  member text NOT NULL,
  amount cella.amount NOT NULL
);

CREATE INDEX ON account_membership_transaction.draw (member);

-- What each member drew, and what is left of their draw limit.
CREATE VIEW account_membership_transaction.drawn AS
SELECT c.member, c.account, c.frozen, c.allowance,
       coalesce((SELECT sum(cella.cents(d.amount)) FROM account_membership_transaction.draw d WHERE d.member = c.member), 0) AS drawn
FROM account_membership.capital c;

-- account:account:draw — a member draws on their own account, while they
-- are active and it is not frozen, within what is left of their draw
-- limit; the entry is exactly the draw: 455 debited and the bank, 512,
-- credited by its amount.
CREATE FUNCTION account_membership_transaction.draws(payload jsonb) RETURNS text
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
    ) OR NOT EXISTS (SELECT FROM account_membership_transaction.draw d WHERE d.entry = x.entry AND d.member = x.member)
      THEN coalesce(x.entry, 'the entry') || ' is not a draw of ' || x.amount || ' cents: 455 debited and 512 credited by it, nothing else'
  END
  FROM (SELECT payload ->> 'member' AS member, (payload ->> 'amount')::bigint AS amount, payload ->> 'entry' AS entry) x
  LEFT JOIN membership.member m ON m.address = x.member
  LEFT JOIN account_membership_transaction.drawn w ON w.member = x.member;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('account:account:draw', 'account_membership_transaction.draws(jsonb)', 'account-membership-transaction');

GRANT USAGE ON SCHEMA account_membership_transaction TO cella_app, cella_guards;
GRANT SELECT ON account_membership_transaction.subscription, account_membership_transaction.draw, account_membership_transaction.drawn TO cella_app, cella_guards;
GRANT INSERT ON account_membership_transaction.subscription, account_membership_transaction.draw TO cella_app;
