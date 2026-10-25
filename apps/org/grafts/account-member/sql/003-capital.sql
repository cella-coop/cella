-- The value of one share is the statutes' capital clause, adopted by the
-- members' decision in the account feat's terms, and no longer a row of
-- this graft's own: the cents of a share on a day, or NULL before any
-- adopted terms give it one.
CREATE FUNCTION account_member.value(day date) RETURNS bigint
LANGUAGE sql STABLE
RETURN (SELECT cella.cents(t.share) FROM account.terms t WHERE t.id = account.capital_for(day));

-- Each member's capital, valued by the terms governing the verdict date.
CREATE OR REPLACE VIEW account_member.capital AS
SELECT m.address AS member, m.name, m.status, m.shares, v.value,
       m.shares * v.value AS subscribed,
       a.code AS account, coalesce(a.frozen, false) AS frozen,
       cella.cents(w.amount) AS allowance
FROM member.member m
JOIN LATERAL (SELECT account_member.value(cella.verdict_date()) AS value) v ON v.value IS NOT NULL
LEFT JOIN account.account a ON a.holder = m.address AND a.parent = '1013'
LEFT JOIN account_member.allowance w ON w.member = m.address;

-- Each worker's part of a year's work share split between shares and
-- cash, as before, at the share's value on the verdict date.
CREATE OR REPLACE VIEW account_member.patronage AS
SELECT s.allocation, s.year, s.worker, s.amount AS part, t.capital AS percent, v.value,
       x.associate, k.shares, k.shares * v.value AS capital, s.amount - k.shares * v.value AS cash,
       (make_date(s.year + 1, 6, 1) + interval '5 years')::date AS until
FROM account.statement s
JOIN account.terms t ON t.id = account.terms_for(s.year)
JOIN LATERAL (SELECT account_member.value(cella.verdict_date()) AS value) v ON v.value IS NOT NULL
CROSS JOIN LATERAL (
  SELECT EXISTS (
    SELECT FROM member.member m
    JOIN account.account a ON a.holder = m.address AND a.parent = '1013' AND NOT a.frozen
    WHERE m.address = s.worker AND m.status = 'active'
  ) AS associate
) x
CROSS JOIN LATERAL (
  SELECT CASE WHEN x.associate AND v.value > 0 THEN floor(s.amount * t.capital / (100 * v.value))::integer ELSE 0 END AS shares
) k;

DROP TABLE account_member.terms;
