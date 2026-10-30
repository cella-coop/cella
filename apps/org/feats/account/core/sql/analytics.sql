-- The account feat's analytical contract: what the analytics shell reads
-- of the chart, its periods, the statements' rubrics and the capital
-- terms. A capital account is a member's, so the chart shows only the
-- accounts no one holds; what the held ones sum to is account-transaction's.
CREATE VIEW account.chart AS
SELECT a.code, a.label, a.kind, a.parent, a.cash, a.frozen
FROM account.account a
WHERE a.holder IS NULL;

COMMENT ON COLUMN account.chart.label IS 'not personal: only a held account''s label names its holder, and the chart shows none';

CREATE VIEW account.periods AS
SELECT p.month, p.closed, to_date(p.month, 'YYYY-MM') AS since, account.period_end(p.month) - 1 AS until
FROM account.period p;

CREATE VIEW account.rubrics AS
SELECT r.id, r.sheet, r.n, r.kind, r.label, r.side, r.prefixes, r.adds, r.subtracts
FROM account.rubric r;

CREATE VIEW account.capital_terms AS
SELECT t.id, t."from", cella.cents(t.share) AS share, t.minimum, t.instalments, t.delay, t.repayments, t.adopted
FROM account.terms t;
