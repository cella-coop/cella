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
SELECT t.id, t.policy, t."from", cella.cents(t.share) AS share, t.minimum, t.instalments, t.delay, t.repayments, t.adopted
FROM account.terms t;

-- The statements' spans: each month, quarter and year the books hold, with
-- its days and the span of the same length before it.
CREATE VIEW account.spans AS
SELECT r.id, r.kind, r.since, r.until, r.before, r.before_since, r.before_until, r.closed
FROM account.report r;

-- Where each account no one holds is presented on each sheet: the line
-- whose prefix of its code is the longest, as `rubric_of` places it. A held
-- account is summed into its parent's code, which is placed here.
CREATE VIEW account.placements AS
SELECT DISTINCT ON (r.sheet, a.code) r.sheet, a.code, r.id AS rubric
FROM account.account a
JOIN account.rubric r ON r.kind = 'line'
CROSS JOIN LATERAL unnest(r.prefixes) p(prefix)
WHERE a.holder IS NULL AND a.code LIKE p.prefix || '%'
ORDER BY r.sheet, a.code, length(p.prefix) DESC;

-- Each total of a sheet expanded down to its lines, as `statement`
-- expands it: a total is the sum of each line times its sign.
CREATE VIEW account.totals AS
WITH RECURSIVE terms AS (
  SELECT r.sheet, r.id AS total, x.part, 1 AS sign FROM account.rubric r CROSS JOIN LATERAL unnest(r.adds) x(part)
  UNION ALL
  SELECT r.sheet, r.id, x.part, -1 FROM account.rubric r CROSS JOIN LATERAL unnest(r.subtracts) x(part)
),
expanded AS (
  SELECT t.sheet, t.total, t.part, t.sign FROM terms t
  UNION ALL
  SELECT e.sheet, e.total, t.part, e.sign * t.sign FROM expanded e JOIN terms t ON t.total = e.part
)
SELECT e.sheet, e.total, e.part AS line, sum(e.sign)::integer AS sign
FROM expanded e
JOIN account.rubric r ON r.id = e.part AND r.kind = 'line'
GROUP BY e.sheet, e.total, e.part;
