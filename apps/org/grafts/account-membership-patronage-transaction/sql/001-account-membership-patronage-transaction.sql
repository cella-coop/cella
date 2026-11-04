CREATE SCHEMA account_membership_patronage_transaction;

-- What each associate's part of a year's work share employed in shares of
-- the capital, by the write that credits it after the distribution: the
-- shares, their value, the capital account they credit, the day they are
-- blocked until (Code du travail, art. L3324-10) and the entry that
-- posted them. One per associate and distribution.
CREATE TABLE account_membership_patronage_transaction.credit (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  distribution text NOT NULL,
  member text NOT NULL,
  account text NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  amount cella.amount NOT NULL,
  until date NOT NULL,
  entry text NOT NULL,
  PRIMARY KEY (distribution, member)
);

-- The associates whose part of a distributed split buys shares and who
-- are not credited yet, in the order of their capital accounts: whom the
-- writes that follow the distribution credit. It runs as its owner, since
-- whoever approved the split may read no colleague's part, and says no
-- more than who.
CREATE FUNCTION account_membership_patronage_transaction.employable(ref text)
RETURNS TABLE (member text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT p.worker
  FROM account_membership_patronage.split p
  JOIN patronage.distribution d ON d.id = p.distribution AND d.distributed IS NOT NULL
  WHERE p.distribution = ref AND p.shares > 0
    AND NOT EXISTS (SELECT FROM account_membership_patronage_transaction.credit c WHERE c.distribution = ref AND c.member = p.worker)
  ORDER BY (SELECT min(a.code) FROM account.account a WHERE a.holder = p.worker AND a.parent = '1013' AND NOT a.frozen), p.worker;
END;

REVOKE EXECUTE ON FUNCTION account_membership_patronage_transaction.employable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION account_membership_patronage_transaction.employable(text) TO cella_app;

-- patronage:part:employ — the member's part of the distribution buys
-- shares, as account_membership_patronage.split gives on the verdict date;
-- this write made their one credit, of exactly those shares at that value,
-- blocked until the day the law sets, on a capital account under 1013
-- they hold, not frozen; and its entry posts exactly 424 (the work share
-- owed) debited and that account credited by it, and no other line, so
-- it touches no cash account. What the member holds is the membership
-- feat's, which keeps no history of it, so that the shares were added to
-- it is not checked here.
CREATE FUNCTION account_membership_patronage_transaction.employs(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN s.worker IS NULL THEN coalesce(x.member, 'no one') || '''s part of ' || coalesce(x.distribution, 'no distribution') || ' buys no shares'
    WHEN c.member IS NULL OR c.entry IS DISTINCT FROM x.entry THEN 'this write credited ' || x.member || ' no shares of ' || x.distribution
    WHEN (c.shares, cella.cents(c.amount)::numeric, c.until) IS DISTINCT FROM (s.shares, s.capital::numeric, s.until)
      THEN x.distribution || ' does not employ in shares what its terms give ' || x.member
    WHEN NOT EXISTS (SELECT FROM account.account a WHERE a.code = c.account AND a.holder = x.member AND a.parent = '1013' AND NOT a.frozen)
      THEN c.account || ' is no open capital account of ' || x.member
    WHEN EXISTS (
      (SELECT '424'::text AS account, 'debit'::text AS side, cella.cents(c.amount) AS cents
       UNION ALL SELECT c.account, 'credit', cella.cents(c.amount))
      EXCEPT ALL
      (SELECT l.account, l.side::text, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = x.entry)
    ) OR EXISTS (
      (SELECT l.account, l.side::text, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = x.entry)
      EXCEPT ALL
      (SELECT '424'::text, 'debit'::text, cella.cents(c.amount)
       UNION ALL SELECT c.account, 'credit', cella.cents(c.amount))
    ) THEN x.entry || ' does not post exactly the shares ' || x.member || '''s part buys: 424 debited and their capital account credited'
  END
  FROM (SELECT payload ->> 'distribution' AS distribution, payload ->> 'member' AS member, payload ->> 'entry' AS entry) x
  LEFT JOIN account_membership_patronage.split s ON s.distribution = x.distribution AND s.worker = x.member AND s.shares > 0
  LEFT JOIN account_membership_patronage_transaction.credit c ON c.distribution = x.distribution AND c.member = x.member;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('patronage:part:employ', 'account_membership_patronage_transaction.employs(jsonb)', 'account-membership-patronage-transaction');

GRANT USAGE ON SCHEMA account_membership_patronage_transaction TO cella_app, cella_guards;
GRANT SELECT ON account_membership_patronage_transaction.credit TO cella_app, cella_guards;
GRANT INSERT ON account_membership_patronage_transaction.credit TO cella_app;
