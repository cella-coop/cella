CREATE SCHEMA account_membership_patronage_transaction;

-- What each associate's part of a year's work share employed in shares of
-- the capital, when the distribution posted: the shares, their value, the
-- capital account they credit, the day they are blocked until (Code du
-- travail, art. L3324-10) and the entry that posted them.
CREATE TABLE account_membership_patronage_transaction.credit (
  distribution text NOT NULL,
  member text NOT NULL,
  account text NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  amount cella.amount NOT NULL,
  until date NOT NULL,
  entry text NOT NULL,
  PRIMARY KEY (distribution, member)
);

-- When a distribution posts its split, in that write, what its parts
-- employ in shares is posted too, as account_membership_patronage.split gives
-- it, in the same entry, since a write posts one: 424 (the work share
-- owed) debited by the whole, and each associate's capital account
-- credited by theirs; their shares are added to what they hold. What is
-- left in 424 is paid in cash, through a write of its own, not built.
CREATE FUNCTION account_membership_patronage_transaction.employs() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total bigint;
  last integer;
BEGIN
  SELECT sum(p.capital) INTO total FROM account_membership_patronage.split p WHERE p.distribution = NEW.distribution AND p.shares > 0;
  IF coalesce(total, 0) = 0 THEN
    RETURN NULL;
  END IF;
  SELECT max(l.n) INTO last FROM transaction.line l WHERE l.entry = NEW.entry;
  INSERT INTO transaction.line (entry, n, account, side, amount)
  SELECT NEW.entry, last + 1, '424', 'debit', cella.amount(total)
  UNION ALL
  SELECT NEW.entry, last + 1 + row_number() OVER (ORDER BY a.code), a.code, 'credit', cella.amount(p.capital)
  FROM account_membership_patronage.split p
  JOIN account.account a ON a.holder = p.worker AND a.parent = '1013' AND NOT a.frozen
  WHERE p.distribution = NEW.distribution AND p.shares > 0;
  INSERT INTO account_membership_patronage_transaction.credit (distribution, member, account, shares, amount, until, entry)
  SELECT NEW.distribution, p.worker, a.code, p.shares, cella.amount(p.capital), p.until, NEW.entry
  FROM account_membership_patronage.split p
  JOIN account.account a ON a.holder = p.worker AND a.parent = '1013' AND NOT a.frozen
  WHERE p.distribution = NEW.distribution AND p.shares > 0;
  UPDATE membership.member m SET shares = m.shares + c.shares
  FROM account_membership_patronage_transaction.credit c
  WHERE c.distribution = NEW.distribution AND c.member = m.address;
  RETURN NULL;
END
$$;

CREATE TRIGGER employs AFTER INSERT ON patronage_transaction.distribution
  FOR EACH ROW EXECUTE FUNCTION account_membership_patronage_transaction.employs();

-- What a distribution employed in shares, as lines of its entry: 424
-- debited by the whole and each capital account credited by its own.
CREATE FUNCTION account_membership_patronage_transaction.employing(ref text)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT '424', 'debit', sum(cella.cents(c.amount))::bigint
  FROM account_membership_patronage_transaction.credit c WHERE c.distribution = ref HAVING count(*) > 0
  UNION ALL
  SELECT c.account, 'credit', cella.cents(c.amount) FROM account_membership_patronage_transaction.credit c WHERE c.distribution = ref;
END;

-- patronage:distribution:distribute — what the distribution employed in
-- shares is exactly what its terms give each associate, blocked until the
-- day the law sets; and its entry posts exactly its split and that: 424
-- debited by the whole, each capital account credited by its own, and no
-- other line, so nothing touches a cash account.
CREATE FUNCTION account_membership_patronage_transaction.credited(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT p.worker, p.shares, p.capital, p.until FROM account_membership_patronage.split p WHERE p.distribution = x.distribution AND p.shares > 0)
      EXCEPT ALL
      (SELECT c.member, c.shares, cella.cents(c.amount), c.until FROM account_membership_patronage_transaction.credit c WHERE c.distribution = x.distribution)
    ) OR EXISTS (
      (SELECT c.member, c.shares, cella.cents(c.amount), c.until FROM account_membership_patronage_transaction.credit c WHERE c.distribution = x.distribution)
      EXCEPT ALL
      (SELECT p.worker, p.shares, p.capital, p.until FROM account_membership_patronage.split p WHERE p.distribution = x.distribution AND p.shares > 0)
    ) THEN x.distribution || ' does not employ in shares what its terms give each associate'
    WHEN EXISTS (SELECT FROM account_membership_patronage_transaction.credit c WHERE c.distribution = x.distribution AND c.entry IS DISTINCT FROM t.entry)
      OR EXISTS (
        (SELECT l.account, l.side, l.cents FROM patronage_transaction.lines(x.distribution) l
         UNION ALL
         SELECT e.account, e.side, e.cents FROM account_membership_patronage_transaction.employing(x.distribution) e)
        EXCEPT ALL
        (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = t.entry)
      ) OR EXISTS (
        (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = t.entry)
        EXCEPT ALL
        (SELECT l.account, l.side, l.cents FROM patronage_transaction.lines(x.distribution) l
         UNION ALL
         SELECT e.account, e.side, e.cents FROM account_membership_patronage_transaction.employing(x.distribution) e)
      ) THEN coalesce(t.entry, 'the distribution''s entry') || ' does not post exactly the split of ' || x.distribution
        || ' and the shares it employs: 424 debited by the whole, each capital account credited by its own'
  END
  FROM (SELECT payload ->> 'distribution' AS distribution) x
  LEFT JOIN patronage_transaction.distribution t ON t.distribution = x.distribution;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('patronage:distribution:distribute', 'account_membership_patronage_transaction.credited(jsonb)', 'account-membership-patronage-transaction');

GRANT USAGE ON SCHEMA account_membership_patronage_transaction TO cella_app, cella_guards;
GRANT SELECT ON account_membership_patronage_transaction.credit TO cella_app, cella_guards;
GRANT INSERT ON account_membership_patronage_transaction.credit TO cella_app;
