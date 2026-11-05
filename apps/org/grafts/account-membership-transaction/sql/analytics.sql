-- The account-membership-transaction graft's analytical contract: what the
-- members subscribed, paid in, drew and were repaid, summed over every
-- member, by month of the entry that posted it.
CREATE VIEW account_membership_transaction.capital_months AS
SELECT x.month, sum(x.subscribed)::bigint AS subscribed, sum(x.paid)::bigint AS paid,
       sum(x.drawn)::bigint AS drawn, sum(x.repaid)::bigint AS repaid
FROM (
  SELECT to_char(e.date, 'YYYY-MM') AS month, cella.cents(s.amount) AS subscribed, 0 AS paid, 0 AS drawn, 0 AS repaid
  FROM account_membership_transaction.subscription s JOIN transaction.entry e ON e.id = s.entry
  UNION ALL
  SELECT to_char(e.date, 'YYYY-MM'), 0, cella.cents(p.amount), 0, 0
  FROM account_membership_transaction.paid p JOIN transaction.entry e ON e.id = p.entry
  UNION ALL
  SELECT to_char(e.date, 'YYYY-MM'), 0, 0, cella.cents(d.amount), 0
  FROM account_membership_transaction.draw d JOIN transaction.entry e ON e.id = d.entry
  UNION ALL
  SELECT to_char(e.date, 'YYYY-MM'), 0, 0, 0, cella.cents(r.amount)
  FROM account_membership_transaction.repayment r JOIN transaction.entry e ON e.id = r.entry
) x
GROUP BY x.month;
COMMENT ON VIEW account_membership_transaction.capital_months IS 'audience: shared by month';

-- Each member's capital moves in each month, subscribed, paid in, drawn
-- and repaid alike, which the port reads to withhold a month too few
-- members or one or two of them make, and no report reads.
CREATE VIEW account_membership_transaction.capital_months_contributions AS
SELECT x.month, x.person, x.circle, sum(x.amount)::bigint AS amount
FROM (
  SELECT to_char(e.date, 'YYYY-MM') AS month, s.member AS person, s.circle, cella.cents(s.amount) AS amount
  FROM account_membership_transaction.subscription s JOIN transaction.entry e ON e.id = s.entry
  UNION ALL
  SELECT to_char(e.date, 'YYYY-MM'), p.member, p.circle, cella.cents(p.amount)
  FROM account_membership_transaction.paid p JOIN transaction.entry e ON e.id = p.entry
  UNION ALL
  SELECT to_char(e.date, 'YYYY-MM'), d.member, d.circle, cella.cents(d.amount)
  FROM account_membership_transaction.draw d JOIN transaction.entry e ON e.id = d.entry
  UNION ALL
  SELECT to_char(e.date, 'YYYY-MM'), r.member, r.circle, cella.cents(r.amount)
  FROM account_membership_transaction.repayment r JOIN transaction.entry e ON e.id = r.entry
) x
GROUP BY x.month, x.person, x.circle;
COMMENT ON VIEW account_membership_transaction.capital_months_contributions IS 'audience: contributions to account_membership_transaction.capital_months, read by account';
COMMENT ON COLUMN account_membership_transaction.capital_months_contributions.person IS 'personal: whose capital it is, which only the port reads';
