-- How each action whose handler is this graft's applies to the state
-- before it (architecture.md, "Folds"): its own rows, the entry by the
-- transaction feat's `transaction.fold_record` and the shares by the
-- membership feat's `membership.fold_credit`, as its handler calls
-- `record` and `crediting`.

-- patronage:part:employ: the entry, the credit as the entry keeps it, and
-- the shares it buys added to what the member holds.
CREATE FUNCTION account_membership_patronage_transaction.fold_employ(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF p -> 'posting' IS NULL THEN
    RAISE EXCEPTION 'account-membership-patronage-transaction: entry % keeps no posting of % in %, so no fold rebuilds it', entry ->> 'n', p ->> 'member', p ->> 'distribution';
  END IF;
  PERFORM transaction.fold_record((entry ->> 'n')::bigint, p ->> 'entry', p -> 'posting');
  INSERT INTO account_membership_patronage_transaction.credit (distribution, member, account, shares, amount, until, entry)
  VALUES (p ->> 'distribution', p ->> 'member', p ->> 'account', (p ->> 'shares')::integer, cella.amount((p ->> 'amount')::bigint),
          (p ->> 'until')::date, p ->> 'entry');
  PERFORM membership.fold_credit(p ->> 'member', (p ->> 'shares')::integer);
END
$$;

SELECT cella.lets_fold('patronage:part:employ', 1, 'account_membership_patronage_transaction.fold_employ(jsonb)', 'account-membership-patronage-transaction');
