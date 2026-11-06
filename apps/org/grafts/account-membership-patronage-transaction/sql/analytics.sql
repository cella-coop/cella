-- The account-membership-patronage-transaction graft's analytical
-- contract: what each distribution credited to the members' capital,
-- summed over every member, and what its entry and the credits that
-- follow it posted, account by account.
CREATE VIEW account_membership_patronage_transaction.credits AS
SELECT c.distribution, count(*)::bigint AS members, coalesce(sum(c.shares), 0)::bigint AS shares,
       coalesce(sum(cella.cents(c.amount)), 0)::bigint AS amount, max(c.until) AS until
FROM account_membership_patronage_transaction.credit c
GROUP BY c.distribution;
COMMENT ON VIEW account_membership_patronage_transaction.credits IS 'audience: shared by distribution';

-- What each distribution's entry and the credits that follow it posted,
-- by account: a member's capital account is summed into its parent's
-- code, so no row is one member's.
CREATE VIEW account_membership_patronage_transaction.posted AS
SELECT x.distribution, CASE WHEN a.holder IS NULL THEN a.code ELSE a.parent END AS code,
       coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'debit'), 0)::bigint AS debit,
       coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'credit'), 0)::bigint AS credit
FROM (
  SELECT d.distribution, d.entry FROM patronage_transaction.distribution d
  UNION ALL
  SELECT c.distribution, c.entry FROM account_membership_patronage_transaction.credit c
) x
JOIN transaction.line l ON l.entry = x.entry
JOIN account.account a ON a.code = l.account
GROUP BY x.distribution, CASE WHEN a.holder IS NULL THEN a.code ELSE a.parent END;
COMMENT ON VIEW account_membership_patronage_transaction.posted IS 'audience: shared by distribution, code';

COMMENT ON COLUMN account_membership_patronage_transaction.posted.code IS 'not personal: a held account is summed into its parent''s code';

-- Each member's credit from each distribution, which the port reads to
-- withhold one too few members or one or two of them take, and no report
-- reads.
CREATE VIEW account_membership_patronage_transaction.credits_contributions AS
SELECT c.distribution, c.member AS person, c.circle, coalesce(sum(cella.cents(c.amount)), 0)::bigint AS amount
FROM account_membership_patronage_transaction.credit c
GROUP BY c.distribution, c.member, c.circle;
COMMENT ON VIEW account_membership_patronage_transaction.credits_contributions IS 'audience: contributions to account_membership_patronage_transaction.credits, read by account';
COMMENT ON COLUMN account_membership_patronage_transaction.credits_contributions.person IS 'personal: whose capital it is, which only the port reads';
