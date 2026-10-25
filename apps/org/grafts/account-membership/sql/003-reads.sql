-- A member's draw limit and capital read as their capital account does:
-- the member, and whoever reads capital (`account`'s readers). A write's
-- transaction sees every row. The register of members, who holds how many
-- shares, stays the membership feat's, which every member reads.
ALTER TABLE account_membership.allowance ENABLE ROW LEVEL SECURITY;

CREATE POLICY reads ON account_membership.allowance FOR SELECT TO cella_app USING ((SELECT cella.sees('account')) OR member = cella.reader() OR cella.reaches('account', member));
CREATE POLICY rules ON account_membership.allowance FOR SELECT TO cella_rules USING (true);

CREATE OR REPLACE VIEW account_membership.capital AS
SELECT m.address AS member, mp.name, m.status, m.shares, v.value,
       m.shares * v.value AS subscribed,
       a.code AS account, coalesce(a.frozen, false) AS frozen,
       cella.cents(w.amount) AS allowance
FROM membership.member m JOIN person.person mp ON mp.address = m.address
JOIN LATERAL (SELECT account_membership.value(cella.verdict_date()) AS value) v ON v.value IS NOT NULL
LEFT JOIN account.account a ON a.holder = m.address AND a.parent = '1013'
LEFT JOIN account_membership.allowance w ON w.member = m.address
WHERE (SELECT cella.sees('account')) OR m.address = cella.reader() OR cella.reaches('account', m.address);
