-- What each associate's part of a year's work share employed in shares of
-- the capital, when the allocation posted: the shares, their value, the
-- capital account they credit, the day they are blocked until (Code du
-- travail, art. L3324-10) and the entry that posted them.
CREATE TABLE account_member_transaction.credit (
  allocation text NOT NULL,
  member text NOT NULL,
  account text NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  amount cella.amount NOT NULL,
  until date NOT NULL,
  entry text NOT NULL,
  PRIMARY KEY (allocation, member)
);

-- When an allocation posts its split, in that write, what its parts
-- employ in shares is posted too, as account_member.patronage gives it,
-- in the same entry, since a write posts one: 424 (the work share owed)
-- debited by the whole, and each associate's capital account credited by
-- theirs; their shares are added to what they hold. What is left in 424
-- is paid in cash, through a write of its own, not built.
CREATE FUNCTION account_member_transaction.employs() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total bigint;
  last integer;
BEGIN
  SELECT sum(p.capital) INTO total FROM account_member.patronage p WHERE p.allocation = NEW.allocation AND p.shares > 0;
  IF coalesce(total, 0) = 0 THEN
    RETURN NULL;
  END IF;
  SELECT max(l.n) INTO last FROM transaction.line l WHERE l.entry = NEW.entry;
  INSERT INTO transaction.line (entry, n, account, side, amount)
  SELECT NEW.entry, last + 1, '424', 'debit', cella.amount(total)
  UNION ALL
  SELECT NEW.entry, last + 1 + row_number() OVER (ORDER BY a.code), a.code, 'credit', cella.amount(p.capital)
  FROM account_member.patronage p
  JOIN account.account a ON a.holder = p.worker AND a.parent = '1013' AND NOT a.frozen
  WHERE p.allocation = NEW.allocation AND p.shares > 0;
  INSERT INTO account_member_transaction.credit (allocation, member, account, shares, amount, until, entry)
  SELECT NEW.allocation, p.worker, a.code, p.shares, cella.amount(p.capital), p.until, NEW.entry
  FROM account_member.patronage p
  JOIN account.account a ON a.holder = p.worker AND a.parent = '1013' AND NOT a.frozen
  WHERE p.allocation = NEW.allocation AND p.shares > 0;
  UPDATE member.member m SET shares = m.shares + c.shares
  FROM account_member_transaction.credit c
  WHERE c.allocation = NEW.allocation AND c.member = m.address;
  RETURN NULL;
END
$$;

CREATE TRIGGER employs AFTER INSERT ON account_transaction.allocation
  FOR EACH ROW EXECUTE FUNCTION account_member_transaction.employs();

-- What an allocation employed in shares, as lines of its entry: 424
-- debited by the whole and each capital account credited by its own.
CREATE FUNCTION account_member_transaction.employing(ref text)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT '424', 'debit', sum(cella.cents(c.amount))::bigint
  FROM account_member_transaction.credit c WHERE c.allocation = ref HAVING count(*) > 0
  UNION ALL
  SELECT c.account, 'credit', cella.cents(c.amount) FROM account_member_transaction.credit c WHERE c.allocation = ref;
END;

-- account:surplus:allocate — what the allocation employed in shares is
-- exactly what its terms give each associate, blocked until the day the
-- law sets, and its entry posts exactly that: 424 debited by the whole,
-- each capital account credited by its own, and nothing else to 424's
-- debit or a capital account.
CREATE FUNCTION account_member_transaction.employed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT p.worker, p.shares, p.capital, p.until FROM account_member.patronage p WHERE p.allocation = x.allocation AND p.shares > 0)
      EXCEPT ALL
      (SELECT c.member, c.shares, cella.cents(c.amount), c.until FROM account_member_transaction.credit c WHERE c.allocation = x.allocation)
    ) OR EXISTS (
      (SELECT c.member, c.shares, cella.cents(c.amount), c.until FROM account_member_transaction.credit c WHERE c.allocation = x.allocation)
      EXCEPT ALL
      (SELECT p.worker, p.shares, p.capital, p.until FROM account_member.patronage p WHERE p.allocation = x.allocation AND p.shares > 0)
    ) THEN x.allocation || ' does not employ in shares what its terms give each associate'
    WHEN EXISTS (SELECT FROM account_member_transaction.credit c WHERE c.allocation = x.allocation AND c.entry IS DISTINCT FROM t.entry)
      OR EXISTS (
        (SELECT e.account, e.side, e.cents FROM account_member_transaction.employing(x.allocation) e)
        EXCEPT ALL
        (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l
         WHERE l.entry = t.entry AND ((l.account = '424' AND l.side = 'debit') OR l.account LIKE '1013%'))
      ) OR EXISTS (
        (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l
         WHERE l.entry = t.entry AND ((l.account = '424' AND l.side = 'debit') OR l.account LIKE '1013%'))
        EXCEPT ALL
        (SELECT e.account, e.side, e.cents FROM account_member_transaction.employing(x.allocation) e)
      ) THEN coalesce(t.entry, 'the allocation''s entry') || ' does not post the shares ' || x.allocation || ' employs: 424 debited by the whole, each capital account credited by its own'
  END
  FROM (SELECT payload ->> 'allocation' AS allocation) x
  LEFT JOIN account_transaction.allocation t ON t.allocation = x.allocation;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('account:surplus:allocate', 'account_member_transaction.employed(jsonb)', 'account-member-transaction');

GRANT SELECT ON account_member_transaction.credit TO cella_app, cella_rules;
GRANT INSERT ON account_member_transaction.credit TO cella_app;
