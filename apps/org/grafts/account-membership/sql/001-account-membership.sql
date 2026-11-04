CREATE SCHEMA account_membership;

-- The value of one share of the co-op's capital, as its statutes set it.
CREATE TABLE account_membership.terms (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  one boolean PRIMARY KEY DEFAULT true CHECK (one),
  share cella.amount NOT NULL
);

-- What each member may draw on their account, granted in advance: the
-- right a draw spends.
CREATE TABLE account_membership.allowance (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  member text PRIMARY KEY,
  amount cella.amount NOT NULL
);

-- A capital account's holder is a member. The account feat holds the
-- address, as text; this graft checks it against the members.
CREATE FUNCTION account_membership.held() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.holder IS NOT NULL AND NOT EXISTS (SELECT FROM membership.member m WHERE m.address = NEW.holder) THEN
    RAISE EXCEPTION '% is held by %, who is no member', NEW.code, NEW.holder
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER held BEFORE INSERT OR UPDATE OF holder ON account.account
  FOR EACH ROW EXECUTE FUNCTION account_membership.held();

-- account:account:freeze, account:own:freeze — a member who leaves has
-- their capital frozen until it is repaid, by the freeze that follows
-- their exclusion or their withdrawal: the holder is a member who has
-- left, so no active member's capital is frozen.
CREATE FUNCTION account_membership.freezes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN coalesce(p.holder, 'no one') || ' is no member'
    WHEN m.status <> 'exited' THEN m.address || ' is ' || m.status || ': only the capital of a member who left is frozen'
  END
  FROM (SELECT payload ->> 'holder' AS holder) p
  LEFT JOIN membership.member m ON m.address = p.holder;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('account:account:freeze', 'account_membership.freezes(jsonb)', 'account-membership'),
  ('account:own:freeze', 'account_membership.freezes(jsonb)', 'account-membership');

-- Each member's capital: their shares at the share's value, the account
-- that holds it, whether it is frozen, and what they may draw.
CREATE VIEW account_membership.capital AS
SELECT m.address AS member, mp.name, m.status, m.shares, cella.cents(t.share) AS value,
       m.shares * cella.cents(t.share) AS subscribed,
       a.code AS account, coalesce(a.frozen, false) AS frozen,
       cella.cents(w.amount) AS allowance
FROM membership.member m JOIN person.person mp ON mp.address = m.address
CROSS JOIN account_membership.terms t
LEFT JOIN account.account a ON a.holder = m.address AND a.parent = '1013'
LEFT JOIN account_membership.allowance w ON w.member = m.address;

GRANT USAGE ON SCHEMA account_membership TO cella_app, cella_guards;
GRANT SELECT ON account_membership.terms, account_membership.allowance, account_membership.capital TO cella_app, cella_guards;

-- Whether a member holds a capital account not yet frozen, so the freeze
-- that follows their exit has something to freeze. It runs as its owner,
-- since whoever closed the motion may read no colleague's capital, and
-- says no more than whether there is one.
CREATE FUNCTION account_membership.unfrozen(member text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT EXISTS (SELECT FROM account.account a WHERE a.holder = unfrozen.member AND NOT a.frozen);
END;

REVOKE EXECUTE ON FUNCTION account_membership.unfrozen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION account_membership.unfrozen(text) TO cella_app;
