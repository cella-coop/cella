-- The account-membership-patronage-transaction graft's analytical
-- contract: what each distribution credited to the members' capital,
-- summed over every member, and what its entry posted, account by account.
CREATE VIEW account_membership_patronage_transaction.credits AS
SELECT c.distribution, count(*)::bigint AS members, coalesce(sum(c.shares), 0)::bigint AS shares,
       coalesce(sum(cella.cents(c.amount)), 0)::bigint AS amount, max(c.until) AS until
FROM account_membership_patronage_transaction.credit c
GROUP BY c.distribution;

-- What each distribution's entry posted, by account: a member's capital
-- account is summed into its parent's code, so no row is one member's.
CREATE VIEW account_membership_patronage_transaction.posted AS
SELECT d.distribution, CASE WHEN a.holder IS NULL THEN a.code ELSE a.parent END AS code,
       coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'debit'), 0)::bigint AS debit,
       coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'credit'), 0)::bigint AS credit
FROM patronage_transaction.distribution d
JOIN transaction.line l ON l.entry = d.entry
JOIN account.account a ON a.code = l.account
GROUP BY d.distribution, CASE WHEN a.holder IS NULL THEN a.code ELSE a.parent END;

COMMENT ON COLUMN account_membership_patronage_transaction.posted.code IS 'not personal: a held account is summed into its parent''s code';
