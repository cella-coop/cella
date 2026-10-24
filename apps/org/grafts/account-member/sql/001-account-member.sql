CREATE SCHEMA account_member;

-- The value of one share of the co-op's capital, as its statutes set it.
CREATE TABLE account_member.terms (
  one boolean PRIMARY KEY DEFAULT true CHECK (one),
  share cella.amount NOT NULL
);

-- What each member may draw on their account, granted in advance: the
-- right a draw spends.
CREATE TABLE account_member.allowance (
  member text PRIMARY KEY,
  amount cella.amount NOT NULL
);

-- A capital account's holder is a member. The account feat holds the
-- address, as text; this graft checks it against the members.
CREATE FUNCTION account_member.held() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.holder IS NOT NULL AND NOT EXISTS (SELECT FROM member.member m WHERE m.address = NEW.holder) THEN
    RAISE EXCEPTION '% is held by %, who is no member', NEW.code, NEW.holder
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER held BEFORE INSERT OR UPDATE OF holder ON account.account
  FOR EACH ROW EXECUTE FUNCTION account_member.held();

-- A member who leaves has their capital frozen until it is repaid, in the
-- write that ends their membership, whichever it is: what they hold takes
-- no draw from then on.
CREATE FUNCTION account_member.freezes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'exited' AND OLD.status <> 'exited' THEN
    UPDATE account.account SET frozen = true WHERE holder = NEW.address AND NOT frozen;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER freezes AFTER UPDATE OF status ON member.member
  FOR EACH ROW EXECUTE FUNCTION account_member.freezes();

-- Each member's capital: their shares at the share's value, the account
-- that holds it, whether it is frozen, and what they may draw.
CREATE VIEW account_member.capital AS
SELECT m.address AS member, m.name, m.status, m.shares, cella.cents(t.share) AS value,
       m.shares * cella.cents(t.share) AS subscribed,
       a.code AS account, coalesce(a.frozen, false) AS frozen,
       cella.cents(w.amount) AS allowance
FROM member.member m
CROSS JOIN account_member.terms t
LEFT JOIN account.account a ON a.holder = m.address AND a.parent = '1013'
LEFT JOIN account_member.allowance w ON w.member = m.address;

GRANT USAGE ON SCHEMA account_member TO cella_app, cella_rules;
GRANT SELECT ON account_member.terms, account_member.allowance, account_member.capital TO cella_app, cella_rules;
