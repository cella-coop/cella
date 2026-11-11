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
-- kept it once payslip-transaction's fold has posted the payment: what
-- it withheld from each associate and what it paid in through their pay,
-- as the commitments its payload keeps of them.
CREATE FUNCTION account_membership_payslip_transaction.fold_pay(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  n bigint := (entry ->> 'n')::bigint;
  k record;
BEGIN
  FOR k IN SELECT x.field, x.subject, x.cents
           FROM jsonb_to_recordset(coalesce(p -> 'kept', '[]')) AS x (field text, subject text, cents jsonb)
           WHERE x.field IN ('account_membership_payslip_transaction.withheld.amount', 'account_membership_transaction.paid.amount')
           ORDER BY x.field DESC, x.subject LOOP
    PERFORM cella.commits(k.field, k.subject, n, k.cents);
    IF k.field = 'account_membership_payslip_transaction.withheld.amount' THEN
      INSERT INTO account_membership_payslip_transaction.withheld (month, member, amount, entry)
      VALUES (p ->> 'month', k.subject, NULL, p ->> 'entry');
    ELSE
      PERFORM account_membership_transaction.pay_in(p ->> 'entry', k.subject, NULL, 'pay');
    END IF;
  END LOOP;
END
$$;

SELECT cella.lets_fold('account:capital:spread', 1, 'account_membership_payslip_transaction.fold_spread(jsonb)', 'account-membership-payslip-transaction');
SELECT cella.lets_fold('payslip:run:pay', 1, 'account_membership_payslip_transaction.fold_pay(jsonb)', 'account-membership-payslip-transaction');
