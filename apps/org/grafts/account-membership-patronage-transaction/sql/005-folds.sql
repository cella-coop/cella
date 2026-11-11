-- How each action whose handler is this graft's applies to the state
-- before it (architecture.md, "Folds"): its own rows, the entry by the
-- transaction feat's `transaction.fold_record` and what the member holds by
-- the membership feat's `membership.fold_credit`, as its handler calls
-- `record` and `crediting`.

-- patronage:part:employ: the entry, the credit as the entry keeps it, its
-- shares and amount as their commitments, and what the member holds once
-- it credits them, as the register shows it.
CREATE FUNCTION account_membership_patronage_transaction.fold_employ(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  n bigint := (entry ->> 'n')::bigint;
BEGIN
  IF p -> 'posting' IS NULL THEN
    RAISE EXCEPTION 'account-membership-patronage-transaction: entry % keeps no posting of % in %, so no fold rebuilds it', entry ->> 'n', p ->> 'member', p ->> 'distribution';
  END IF;
  PERFORM transaction.fold_record(n, p ->> 'entry', p -> 'posting');
  PERFORM cella.commits('account_membership_patronage_transaction.credit.shares', p ->> 'member', n, p -> 'shares');
  PERFORM cella.commits('account_membership_patronage_transaction.credit.amount', p ->> 'member', n, p -> 'amount');
  INSERT INTO account_membership_patronage_transaction.credit (distribution, member, account, shares, amount, until, entry)
  VALUES (p ->> 'distribution', p ->> 'member', p ->> 'account', NULL, NULL, (p ->> 'until')::date, p ->> 'entry');
  PERFORM membership.fold_credit(p ->> 'member', (p ->> 'holds')::integer);
END
$$;

SELECT cella.lets_fold('patronage:part:employ', 1, 'account_membership_patronage_transaction.fold_employ(jsonb)', 'account-membership-patronage-transaction');
