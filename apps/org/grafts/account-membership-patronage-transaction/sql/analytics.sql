-- The account-membership-patronage-transaction graft's analytical
-- contract: what each distribution credited to the members' capital,
-- summed over every member.
CREATE VIEW account_membership_patronage_transaction.credits AS
SELECT c.distribution, count(*)::bigint AS members, coalesce(sum(c.shares), 0)::bigint AS shares,
       coalesce(sum(cella.cents(c.amount)), 0)::bigint AS amount
FROM account_membership_patronage_transaction.credit c
GROUP BY c.distribution;
