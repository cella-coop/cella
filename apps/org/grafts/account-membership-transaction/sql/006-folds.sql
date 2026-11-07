-- How each action whose handler is this graft's applies to the state
-- before it (architecture.md, "Folds"): its own rows, the entry it posts
-- by the transaction feat's `transaction.fold_record`, and the capital
-- account a subscription opens by the account feat's
-- `account.fold_holding`, as its handler calls `record` and `holding`. A
-- write that wrote nothing logs no posting, and its guard refused it, so
-- no settled entry lacks one.

-- The entry a write posted, as its payload keeps it.
CREATE FUNCTION account_membership_transaction.fold_posting(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF entry -> 'payload' -> 'posting' IS NULL THEN
    RAISE EXCEPTION 'account-membership-transaction: entry % keeps no posting, so no fold rebuilds it', entry ->> 'n';
  END IF;
  PERFORM transaction.fold_record((entry ->> 'n')::bigint, entry -> 'payload' ->> 'entry', entry -> 'payload' -> 'posting');
END
$$;

-- account:capital:subscribe: the member's capital account, its label as
-- its commitment, the shares called in the entry, and the subscription.
CREATE FUNCTION account_membership_transaction.fold_subscribe(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM account.fold_holding((entry ->> 'n')::bigint, p ->> 'account', '1013', p ->> 'member', p -> 'label');
  PERFORM account_membership_transaction.fold_posting(entry);
  INSERT INTO account_membership_transaction.subscription (member, account, shares, entry, amount)
  VALUES (p ->> 'member', p ->> 'account', (p ->> 'shares')::integer, p ->> 'entry', cella.amount((p ->> 'amount')::bigint));
END
$$;

-- account:capital:pay: the entry, and the payment in, its amount as its
-- commitment.
CREATE FUNCTION account_membership_transaction.fold_pay(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM account_membership_transaction.fold_posting(entry);
  PERFORM cella.commits('account_membership_transaction.paid.amount', p ->> 'member', (entry ->> 'n')::bigint, p -> 'amount');
  PERFORM account_membership_transaction.pay_in(p ->> 'entry', p ->> 'member', NULL, 'bank');
END
$$;

-- account:account:draw: the entry, and the draw, its amount as its
-- commitment.
CREATE FUNCTION account_membership_transaction.fold_draw(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM account_membership_transaction.fold_posting(entry);
  PERFORM cella.commits('account_membership_transaction.draw.amount', p ->> 'member', (entry ->> 'n')::bigint, p -> 'amount');
  INSERT INTO account_membership_transaction.draw (entry, member, amount) VALUES (p ->> 'entry', p ->> 'member', NULL);
END
$$;

-- account:capital:repay: the entry, and the repayment it pays, paid on
-- the entry's day.
CREATE FUNCTION account_membership_transaction.fold_repay(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  day date := (entry ->> 'date')::date;
BEGIN
  PERFORM account_membership_transaction.fold_posting(entry);
  UPDATE account_membership_transaction.repayment SET entry = p ->> 'entry', paid = day
  WHERE member = p ->> 'member' AND n = (p ->> 'n')::integer;
END
$$;

-- account:capital:withdraw and account:own:withdraw: the entry, what it
-- cancelled of the subscription, the repayments drawn up by the SQL its
-- handler runs, on what the entry owes, which must draw as many as it
-- says, and the withdrawal.
CREATE FUNCTION account_membership_transaction.fold_withdraw(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  drawn integer := 0;
BEGIN
  PERFORM account_membership_transaction.fold_posting(entry);
  IF (p ->> 'cancelled')::bigint > 0 THEN
    UPDATE account_membership_transaction.subscription SET cancelled = cella.amount((p ->> 'cancelled')::bigint) WHERE member = p ->> 'member';
  END IF;
  IF (p ->> 'owed')::bigint > 0 THEN
    INSERT INTO account_membership_transaction.repayment (member, n, due, amount)
    SELECT p ->> 'member', r.n, r.due, cella.amount((cella.allocate(cella.amount((p ->> 'owed')::bigint), array_fill(1::bigint, ARRAY[t.repayments])))[r.n])
    FROM membership.member m
    CROSS JOIN LATERAL account.repayments(account.capital_for(m.exited), m.exited) r
    JOIN account.terms t ON t.id = account.capital_for(m.exited)
    WHERE m.address = p ->> 'member';
    GET DIAGNOSTICS drawn = ROW_COUNT;
  END IF;
  IF drawn <> (p ->> 'repayments')::integer THEN
    RAISE EXCEPTION 'account-membership-transaction: entry % draws up % repayments for %, but its terms draw up %', entry ->> 'n', p ->> 'repayments', p ->> 'member', drawn;
  END IF;
  INSERT INTO account_membership_transaction.withdrawal (member, entry) VALUES (p ->> 'member', p ->> 'entry');
END
$$;

SELECT cella.lets_fold('account:capital:subscribe', 1, 'account_membership_transaction.fold_subscribe(jsonb)', 'account-membership-transaction');
SELECT cella.lets_fold('account:capital:pay', 1, 'account_membership_transaction.fold_pay(jsonb)', 'account-membership-transaction');
SELECT cella.lets_fold('account:account:draw', 1, 'account_membership_transaction.fold_draw(jsonb)', 'account-membership-transaction');
SELECT cella.lets_fold('account:capital:repay', 1, 'account_membership_transaction.fold_repay(jsonb)', 'account-membership-transaction');
SELECT cella.lets_fold('account:capital:withdraw', 1, 'account_membership_transaction.fold_withdraw(jsonb)', 'account-membership-transaction');
SELECT cella.lets_fold('account:own:withdraw', 1, 'account_membership_transaction.fold_withdraw(jsonb)', 'account-membership-transaction');
