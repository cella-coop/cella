CREATE SCHEMA account_membership_patronage;

-- Each worker's part of a year's work share, split as the year's terms
-- say between what is employed in shares of the capital and what is paid
-- in cash. Only an associate employed in the co-op takes shares (Code du
-- travail, art. R3323-11): an active member holding a capital account that
-- is not frozen. They take whole shares at the share's value on the
-- verdict date, as many as the terms' percent of their part buys, and the
-- rest is paid; a worker who is no associate is paid it all. Shares so
-- taken are blocked five years from the first day of the sixth month
-- after the year (art. L3324-10). The split is computed from the parts
-- and today's members: what was employed when the distribution posted is
-- the record of the graft that credits it.
CREATE VIEW account_membership_patronage.split AS
SELECT s.distribution, s.year, s.worker, s.amount AS part, t.capital AS percent, v.value,
       x.associate, k.shares, k.shares * v.value AS capital, s.amount - k.shares * v.value AS cash,
       (make_date(s.year + 1, 6, 1) + interval '5 years')::date AS until
FROM patronage.statement s
JOIN patronage.terms t ON t.id = patronage.terms_for(s.year)
JOIN LATERAL (SELECT account_membership.value(cella.verdict_date()) AS value) v ON v.value IS NOT NULL
CROSS JOIN LATERAL (
  SELECT EXISTS (
    SELECT FROM membership.member m
    JOIN account.account a ON a.holder = m.address AND a.parent = '1013' AND NOT a.frozen
    WHERE m.address = s.worker AND m.status = 'active'
  ) AS associate
) x
CROSS JOIN LATERAL (
  SELECT CASE WHEN x.associate AND v.value > 0 THEN floor(s.amount * t.capital / (100 * v.value))::integer ELSE 0 END AS shares
) k;

GRANT USAGE ON SCHEMA account_membership_patronage TO cella_app, cella_guards;
GRANT SELECT ON account_membership_patronage.split TO cella_app, cella_guards;
