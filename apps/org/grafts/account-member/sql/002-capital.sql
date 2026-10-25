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

DROP TABLE account_member.terms;
