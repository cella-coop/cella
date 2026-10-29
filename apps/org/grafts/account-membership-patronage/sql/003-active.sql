-- An associate is an active member, as membership says one is on the
-- verdict date (`membership.active`), not by a copy of its status, who
-- holds a capital account not frozen.
CREATE OR REPLACE VIEW account_membership_patronage.split WITH (security_invoker = true) AS
SELECT s.distribution, s.year, s.worker, s.amount AS part, t.capital AS percent, v.value,
       x.associate, k.shares, k.shares * v.value AS capital, s.amount - k.shares * v.value AS cash,
       (make_date(s.year + 1, 6, 1) + interval '5 years')::date AS until
FROM patronage.statement s
JOIN patronage.terms t ON t.id = patronage.terms_for(s.year)
JOIN LATERAL (SELECT account_membership.value(cella.verdict_date()) AS value) v ON v.value IS NOT NULL
CROSS JOIN LATERAL (
  SELECT EXISTS (
    SELECT FROM account.account a
    WHERE a.holder = s.worker AND a.parent = '1013' AND NOT a.frozen AND membership.active(s.worker, cella.verdict_date())
  ) AS associate
) x
CROSS JOIN LATERAL (
  SELECT CASE WHEN x.associate AND v.value > 0 THEN floor(s.amount * t.capital / (100 * v.value))::integer ELSE 0 END AS shares
) k;
