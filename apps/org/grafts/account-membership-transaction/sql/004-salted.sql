-- The amount of a payment in and of a draw is personal data of its member,
-- of class `books`: the write's payload commits to it, and the vault keeps
-- it, so the log's digest confirms no guess at a colleague's capital; the
-- journal shows it on the bank's line as the books do. Once a former
-- member's clock runs out the sweep redacts it to NULL, so the amounts are
-- nullable. A repayment's amount is logged as given: it falls due after
-- its member left, perhaps after their erasure, which refuses any later
-- value of their class.
ALTER TABLE account_membership_transaction.paid ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE account_membership_transaction.draw ALTER COLUMN amount DROP NOT NULL;

INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('account_membership_transaction', 'paid', 'amount', 'books', 'member', 'account-membership-transaction'),
  ('account_membership_transaction', 'draw', 'amount', 'books', 'member', 'account-membership-transaction');

-- account:account:draw — as before, the amount read from the draw its
-- write recorded, since the payload commits to it.
CREATE OR REPLACE FUNCTION account_membership_transaction.draws(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN x.member IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may draw only on their own account, not ' || coalesce(x.member, 'no one') || '''s'
    WHEN m.status IS DISTINCT FROM 'active' THEN x.member || ' is ' || coalesce(m.status, 'no member') || ': only an active member draws'
    WHEN w.account IS NULL THEN x.member || ' holds no capital account'
    WHEN w.frozen THEN w.account || ' is frozen: ' || x.member || ' left, and draws nothing until it is repaid'
    WHEN d.amount IS NULL THEN coalesce(x.entry, 'the entry') || ' records no draw of ' || x.member || '''s'
    WHEN w.allowance IS NULL OR w.drawn > w.allowance
      THEN 'a draw of ' || d.amount || ' cents exceeds what is left of ' || x.member || '''s draw limit, '
        || greatest(coalesce(w.allowance, 0) - w.drawn + d.amount, 0) || ' of ' || coalesce(w.allowance, 0) || ' cents'
    WHEN (
      SELECT count(*) FILTER (WHERE NOT ((l.account = '455' AND l.side = 'debit') OR (l.account = '512' AND l.side = 'credit'))) <> 0
        OR count(*) <> 2 OR count(DISTINCT l.account) <> 2 OR bool_or(cella.cents(l.amount) <> d.amount)
      FROM transaction.line l WHERE l.entry = x.entry
    ) THEN x.entry || ' is not a draw of ' || d.amount || ' cents: 455 debited and 512 credited by it, nothing else'
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'entry' AS entry) x
  LEFT JOIN membership.member m ON m.address = x.member
  LEFT JOIN account_membership_transaction.drawn w ON w.member = x.member
  LEFT JOIN (SELECT d.entry, d.member, cella.cents(d.amount) AS amount FROM account_membership_transaction.draw d) d
    ON d.entry = x.entry AND d.member = x.member;
END;

-- account:capital:pay — as before, the amount read from the payment in its
-- write recorded, since the payload commits to it.
CREATE OR REPLACE FUNCTION account_membership_transaction.pays(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.member IS NULL THEN coalesce(x.member, 'no one') || ' has no subscription to pay'
    WHEN d.amount IS NULL
      THEN coalesce(x.entry, 'the entry') || ' records no payment from the bank on ' || x.member || '''s subscription'
    WHEN c.unpaid < 0
      THEN 'a payment of ' || d.amount || ' cents exceeds what ' || x.member || ' owes on their subscription, '
        || (c.unpaid + d.amount) || ' cents'
    WHEN EXISTS (
      (SELECT p.account, p.side, p.cents FROM account_membership_transaction.paying(c.account, d.amount) p)
      EXCEPT ALL
      (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = x.entry)
    ) OR EXISTS (
      (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = x.entry)
      EXCEPT ALL
      (SELECT p.account, p.side, p.cents FROM account_membership_transaction.paying(c.account, d.amount) p)
    ) THEN x.entry || ' is not a payment of ' || d.amount || ' cents on ' || x.member
      || '''s subscription: 512 debited and 4562 credited, 1012 debited and ' || c.account || ' credited, nothing else'
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'entry' AS entry) x
  LEFT JOIN account_membership_transaction.called c ON c.member = x.member
  LEFT JOIN (SELECT d.entry, d.member, cella.cents(d.amount) AS amount FROM account_membership_transaction.paid d WHERE d.via = 'bank') d
    ON d.entry = x.entry AND d.member = x.member;
END;
