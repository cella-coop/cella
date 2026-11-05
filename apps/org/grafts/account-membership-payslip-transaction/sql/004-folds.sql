-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds").

-- account:capital:spread: the member's plan, each instalment as its
-- commitment, from the entry's day, counting the instalments their pay
-- withheld before it, as its handler counts them.
CREATE FUNCTION account_membership_payslip_transaction.fold_spread(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM cella.commits('account_membership_payslip_transaction.plan.each', p ->> 'member', (entry ->> 'n')::bigint, p -> 'each');
  INSERT INTO account_membership_payslip_transaction.plan (member, instalments, each, since, prior)
  VALUES (p ->> 'member', (p ->> 'instalments')::integer, NULL, (entry ->> 'date')::date,
          (SELECT count(*) FROM account_membership_payslip_transaction.withheld w WHERE w.member = p ->> 'member'))
  ON CONFLICT (member) DO UPDATE SET instalments = EXCLUDED.instalments, each = EXCLUDED.each, since = EXCLUDED.since, prior = EXCLUDED.prior;
END
$$;

-- payslip:run:pay: each instalment the payment withheld, as `keeps`
-- kept it once payslip-transaction's fold has posted the payment: the
-- lines its entry keeps that credit an associate's capital account under
-- 1013, which are this graft's alone, each withheld from its holder and
-- paid in through their pay.
CREATE FUNCTION account_membership_payslip_transaction.fold_pay(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO account_membership_payslip_transaction.withheld (month, member, amount, entry)
  SELECT p ->> 'month', a.holder, cella.amount(l.cents), p ->> 'entry'
  FROM jsonb_to_recordset(p -> 'posting' -> 'lines') AS l (account text, side text, cents bigint)
  JOIN account.account a ON a.code = l.account AND a.parent = '1013' AND a.holder IS NOT NULL
  WHERE l.side = 'credit';
  PERFORM account_membership_transaction.pay_in(w.entry, w.member, w.amount, 'pay')
  FROM account_membership_payslip_transaction.withheld w WHERE w.month = p ->> 'month';
END
$$;

SELECT cella.lets_fold('account:capital:spread', 1, 'account_membership_payslip_transaction.fold_spread(jsonb)', 'account-membership-payslip-transaction');
SELECT cella.lets_fold('payslip:run:pay', 1, 'account_membership_payslip_transaction.fold_pay(jsonb)', 'account-membership-payslip-transaction');
