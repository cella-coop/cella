-- A member's capital account is opened when they subscribe and frozen when
-- they leave, until it is repaid; a frozen account never thaws. Which
-- member holds one, and when, is the account-membership graft's.
CREATE FUNCTION account.stays_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.frozen AND NOT NEW.frozen THEN
    RAISE EXCEPTION '% is frozen until it is repaid', OLD.code
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_frozen BEFORE UPDATE OF frozen ON account.account
  FOR EACH ROW EXECUTE FUNCTION account.stays_frozen();

GRANT INSERT ON account.account TO cella_app;
GRANT UPDATE (frozen) ON account.account TO cella_app;

-- account:account:freeze — the accounts the payload names are exactly
-- those the holder holds, each frozen: the write froze every one. That the
-- holder left is account-membership's guard.
CREATE FUNCTION account.freezes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.holder IS NULL THEN 'a freeze names whose accounts it freezes'
    WHEN EXISTS (SELECT FROM account.account a WHERE a.holder = p.holder AND NOT a.frozen)
      THEN (SELECT min(a.code) FROM account.account a WHERE a.holder = p.holder AND NOT a.frozen) || ', held by ' || p.holder || ', is not frozen'
    WHEN coalesce((SELECT array_agg(a.code ORDER BY a.code) FROM account.account a WHERE a.holder = p.holder), '{}')
      IS DISTINCT FROM coalesce((SELECT array_agg(c ORDER BY c) FROM jsonb_array_elements_text(payload -> 'accounts') c), '{}')
      THEN 'the freeze names other accounts than those ' || p.holder || ' holds'
  END
  FROM (SELECT payload ->> 'holder' AS holder) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('account:account:freeze', 'account.freezes(jsonb)', 'account');

-- account:own:freeze, account:own:withdraw — the same freeze and
-- withdrawal of capital as the member's own, once they withdrew by their
-- right: the holder, or the member, the payload names is the actor. That
-- they left is the grafts' guards'.
CREATE FUNCTION account.owns(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.whose IS DISTINCT FROM cella.actor()
      THEN cella.actor() || ' may not ' || split_part(cella.action(), ':', 3) || ' ' || coalesce(p.whose, 'no one') || '''s capital: only their own'
  END
  FROM (SELECT coalesce(payload ->> 'holder', payload ->> 'member') AS whose) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('account:own:freeze', 'account.freezes(jsonb)', 'account'),
  ('account:own:freeze', 'account.owns(jsonb)', 'account'),
  ('account:own:withdraw', 'account.owns(jsonb)', 'account');

-- Each is the member's own right's, `withdraw-membership`, which the
-- membership feat's guard checks the actor holds.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:own:freeze', 'withdraw-membership', NULL, 'account'),
  ('account:own:withdraw', 'withdraw-membership', NULL, 'account');
