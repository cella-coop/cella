-- The annual accounts' presentation: the rubrics of the balance sheet
-- (bilan) and of the income statement (compte de résultat), in the order
-- the PCG's models list them for a small company (Règlement ANC n° 2014-03,
-- the models of the annual accounts, the système de base, art. 821-1 ff.;
-- not verified on Légifrance, which refuses the box). A `line` gathers the
-- accounts whose code its longest matching prefix names, each signed by
-- its side, so an asset or an expense is debit positive and a liability or
-- an income credit positive; a `total` adds and subtracts other rubrics; a
-- `heading` only names what follows. On the balance sheet, classes 6 and 7
-- are the result of the period, not yet carried to 12 by a closing entry,
-- so every account is placed once and the balance sheet balances. Each
-- rubric's label is English, as IFRS and common EU usage name it; its id,
-- order and prefixes are the PCG's.
CREATE TABLE account.rubric (
  id text PRIMARY KEY CHECK (id ~ '^[a-z]+(-[a-z]+)*$'),
  sheet text NOT NULL CHECK (sheet IN ('balance', 'income')),
  n integer NOT NULL CHECK (n > 0),
  kind text NOT NULL CHECK (kind IN ('heading', 'line', 'total')),
  label text NOT NULL CHECK (label <> ''),
  side text CHECK (side IN ('debit', 'credit')),
  prefixes text[] NOT NULL DEFAULT '{}',
  adds text[] NOT NULL DEFAULT '{}',
  subtracts text[] NOT NULL DEFAULT '{}',
  UNIQUE (sheet, n),
  CHECK ((kind = 'line') = (side IS NOT NULL)),
  CHECK (kind = 'line' OR prefixes = '{}'),
  CHECK (kind = 'total' OR (adds = '{}' AND subtracts = '{}'))
);

INSERT INTO account.rubric (id, sheet, n, kind, label, side, prefixes, adds, subtracts) VALUES
  ('assets', 'balance', 1, 'heading', 'Assets', NULL, '{}', '{}', '{}'),
  ('fixed', 'balance', 2, 'heading', 'Non-current assets', NULL, '{}', '{}', '{}'),
  ('intangible', 'balance', 3, 'line', 'Intangible assets', 'debit', '{20,280,290}', '{}', '{}'),
  ('tangible', 'balance', 4, 'line', 'Property, plant and equipment', 'debit', '{2,21,22,23,281,282,291,292,293}', '{}', '{}'),
  ('financial', 'balance', 5, 'line', 'Financial assets', 'debit', '{26,27,296,297}', '{}', '{}'),
  ('fixed-total', 'balance', 6, 'total', 'Total non-current assets', NULL, '{}', '{intangible,tangible,financial}', '{}'),
  ('current', 'balance', 7, 'heading', 'Current assets', NULL, '{}', '{}', '{}'),
  ('stocks', 'balance', 8, 'line', 'Inventories and work in progress', 'debit', '{3}', '{}', '{}'),
  ('advances-paid', 'balance', 9, 'line', 'Advances and deposits paid on orders', 'debit', '{4091}', '{}', '{}'),
  ('receivables', 'balance', 10, 'line', 'Trade receivables', 'debit', '{41,491}', '{}', '{}'),
  ('other-receivables', 'balance', 11, 'line', 'Other receivables', 'debit', '{4096,4098,425,4287,4387,441,4456,4458,4561,462,465,4687}', '{}', '{}'),
  ('called-capital', 'balance', 12, 'line', 'Subscribed capital called but unpaid', 'debit', '{4562}', '{}', '{}'),
  ('securities', 'balance', 13, 'line', 'Marketable securities', 'debit', '{50,590}', '{}', '{}'),
  ('cash', 'balance', 14, 'line', 'Cash and cash equivalents', 'debit', '{5,51,53,54}', '{}', '{}'),
  ('prepaid', 'balance', 15, 'line', 'Prepaid expenses', 'debit', '{486}', '{}', '{}'),
  ('current-total', 'balance', 16, 'total', 'Total current assets', NULL, '{}', '{stocks,advances-paid,receivables,other-receivables,called-capital,securities,cash,prepaid}', '{}'),
  ('assets-total', 'balance', 17, 'total', 'Total assets', NULL, '{}', '{fixed-total,current-total}', '{}'),
  ('liabilities', 'balance', 18, 'heading', 'Equity and liabilities', NULL, '{}', '{}', '{}'),
  ('equity', 'balance', 19, 'heading', 'Equity', NULL, '{}', '{}', '{}'),
  ('capital', 'balance', 20, 'line', 'Share capital', 'credit', '{101,108}', '{}', '{}'),
  ('premiums', 'balance', 21, 'line', 'Share, merger and contribution premiums', 'credit', '{104}', '{}', '{}'),
  ('revaluation', 'balance', 22, 'line', 'Revaluation surplus', 'credit', '{105}', '{}', '{}'),
  ('legal-reserve', 'balance', 23, 'line', 'Legal reserve', 'credit', '{1061}', '{}', '{}'),
  ('statutory-reserves', 'balance', 24, 'line', 'Statutory or contractual reserves', 'credit', '{1063}', '{}', '{}'),
  ('other-reserves', 'balance', 25, 'line', 'Other reserves', 'credit', '{106,1062,1064,1068}', '{}', '{}'),
  ('carried', 'balance', 26, 'line', 'Retained earnings', 'credit', '{11}', '{}', '{}'),
  ('to-allocate', 'balance', 27, 'line', 'Profit or loss awaiting allocation', 'credit', '{12}', '{}', '{}'),
  ('period-result', 'balance', 28, 'line', 'Profit or loss for the period', 'credit', '{6,7}', '{}', '{}'),
  ('grants', 'balance', 29, 'line', 'Investment grants', 'credit', '{13}', '{}', '{}'),
  ('regulated', 'balance', 30, 'line', 'Regulated provisions', 'credit', '{14}', '{}', '{}'),
  ('equity-total', 'balance', 31, 'total', 'Total equity', NULL, '{}', '{capital,premiums,revaluation,legal-reserve,statutory-reserves,other-reserves,carried,to-allocate,period-result,grants,regulated}', '{}'),
  ('provisions', 'balance', 32, 'line', 'Provisions for liabilities and charges', 'credit', '{15}', '{}', '{}'),
  ('debts', 'balance', 33, 'heading', 'Liabilities', NULL, '{}', '{}', '{}'),
  ('bank-loans', 'balance', 34, 'line', 'Bank loans and borrowings', 'credit', '{164,519}', '{}', '{}'),
  ('other-loans', 'balance', 35, 'line', 'Other loans and borrowings', 'credit', '{1,16,17,455}', '{}', '{}'),
  ('advances-received', 'balance', 36, 'line', 'Advances and deposits received on orders', 'credit', '{419}', '{}', '{}'),
  ('suppliers', 'balance', 37, 'line', 'Trade payables', 'credit', '{401,403,4081}', '{}', '{}'),
  ('tax-social', 'balance', 38, 'line', 'Tax and social security payables', 'credit', '{421,422,424,427,4282,4286,43,4382,4386,442,443,444,4455,4457,446,447,4482,4486}', '{}', '{}'),
  ('fixed-suppliers', 'balance', 39, 'line', 'Payables on non-current assets', 'credit', '{404,405,4084}', '{}', '{}'),
  ('other-debts', 'balance', 40, 'line', 'Other liabilities', 'credit', '{4,457,4567,46,4686,509}', '{}', '{}'),
  ('deferred', 'balance', 41, 'line', 'Deferred income', 'credit', '{487}', '{}', '{}'),
  ('debts-total', 'balance', 42, 'total', 'Total liabilities', NULL, '{}', '{bank-loans,other-loans,advances-received,suppliers,tax-social,fixed-suppliers,other-debts,deferred}', '{}'),
  ('liabilities-total', 'balance', 43, 'total', 'Total equity and liabilities', NULL, '{}', '{equity-total,provisions,debts-total}', '{}'),

  ('operating-income', 'income', 1, 'heading', 'Operating income', NULL, '{}', '{}', '{}'),
  ('goods-sold', 'income', 2, 'line', 'Sales of goods', 'credit', '{707,7097}', '{}', '{}'),
  ('production-sold', 'income', 3, 'line', 'Sales of products and services', 'credit', '{70}', '{}', '{}'),
  ('production-stored', 'income', 4, 'line', 'Change in finished goods and work in progress', 'credit', '{713}', '{}', '{}'),
  ('production-capitalised', 'income', 5, 'line', 'Own work capitalised', 'credit', '{72}', '{}', '{}'),
  ('subsidies', 'income', 6, 'line', 'Operating grants', 'credit', '{74}', '{}', '{}'),
  ('reversals', 'income', 7, 'line', 'Reversals of depreciation and provisions, and expense transfers', 'credit', '{781,791}', '{}', '{}'),
  ('other-income', 'income', 8, 'line', 'Other income', 'credit', '{7,75}', '{}', '{}'),
  ('operating-income-total', 'income', 9, 'total', 'Total operating income', NULL, '{}', '{goods-sold,production-sold,production-stored,production-capitalised,subsidies,reversals,other-income}', '{}'),
  ('operating-expenses', 'income', 10, 'heading', 'Operating expenses', NULL, '{}', '{}', '{}'),
  ('goods-bought', 'income', 11, 'line', 'Purchases of goods', 'debit', '{607,6087,6097}', '{}', '{}'),
  ('goods-stock', 'income', 12, 'line', 'Change in inventories of goods', 'debit', '{6037}', '{}', '{}'),
  ('materials', 'income', 13, 'line', 'Purchases of raw materials and other supplies', 'debit', '{601,602,6081,6082,6091,6092}', '{}', '{}'),
  ('materials-stock', 'income', 14, 'line', 'Change in inventories of raw materials and supplies', 'debit', '{6031,6032}', '{}', '{}'),
  ('external', 'income', 15, 'line', 'Other purchases and external expenses', 'debit', '{60,61,62}', '{}', '{}'),
  ('taxes', 'income', 16, 'line', 'Taxes, duties and similar levies', 'debit', '{63}', '{}', '{}'),
  ('wages', 'income', 17, 'line', 'Wages and salaries', 'debit', '{64,641,644}', '{}', '{}'),
  ('social', 'income', 18, 'line', 'Social security costs', 'debit', '{645,646,647,648}', '{}', '{}'),
  ('depreciation', 'income', 19, 'line', 'Depreciation, amortisation and provisions', 'debit', '{681}', '{}', '{}'),
  ('other-expenses', 'income', 20, 'line', 'Other expenses', 'debit', '{6,65}', '{}', '{}'),
  ('operating-expenses-total', 'income', 21, 'total', 'Total operating expenses', NULL, '{}', '{goods-bought,goods-stock,materials,materials-stock,external,taxes,wages,social,depreciation,other-expenses}', '{}'),
  ('operating-result', 'income', 22, 'total', 'Operating profit or loss', NULL, '{}', '{operating-income-total}', '{operating-expenses-total}'),
  ('financial-income', 'income', 23, 'line', 'Financial income', 'credit', '{76,786,796}', '{}', '{}'),
  ('financial-expenses', 'income', 24, 'line', 'Financial expenses', 'debit', '{66,686}', '{}', '{}'),
  ('financial-result', 'income', 25, 'total', 'Financial profit or loss', NULL, '{}', '{financial-income}', '{financial-expenses}'),
  ('current-result', 'income', 26, 'total', 'Profit or loss before exceptional items and tax', NULL, '{}', '{operating-result,financial-result}', '{}'),
  ('exceptional-income', 'income', 27, 'line', 'Exceptional income', 'credit', '{77,787,797}', '{}', '{}'),
  ('exceptional-expenses', 'income', 28, 'line', 'Exceptional expenses', 'debit', '{67,687}', '{}', '{}'),
  ('exceptional-result', 'income', 29, 'total', 'Exceptional profit or loss', NULL, '{}', '{exceptional-income}', '{exceptional-expenses}'),
  ('participation', 'income', 30, 'line', 'Employee profit sharing', 'debit', '{691}', '{}', '{}'),
  ('income-tax', 'income', 31, 'line', 'Income tax', 'debit', '{69,695,696,698}', '{}', '{}'),
  ('result', 'income', 32, 'total', 'Profit or loss', NULL, '{}', '{current-result,exceptional-result}', '{participation,income-tax}');

-- The rubric of a sheet an account is presented in: the line whose prefix
-- of the code is the longest. A class 1 to 5 account has none on the
-- income statement.
CREATE FUNCTION account.rubric_of(sheet text, code text) RETURNS text
LANGUAGE sql STABLE
RETURN (
  SELECT r.id FROM account.rubric r, unnest(r.prefixes) p
  WHERE r.sheet = rubric_of.sheet AND r.kind = 'line' AND rubric_of.code LIKE p || '%'
  ORDER BY length(p) DESC
  LIMIT 1
);

-- The spans the statements are drawn for, from the periods of the books:
-- each month, each quarter and each year holding one, with its first and
-- last day, the span of the same length just before it, which the
-- statements compare it with, and whether every period of it is closed.
-- The fiscal year is the calendar year.
CREATE VIEW account.report AS
WITH months AS (
  SELECT to_date(p.month, 'YYYY-MM') AS first, p.closed FROM account.period p
),
spans AS (
  SELECT 'month' AS kind, first AS since, interval '1 month' AS length, closed FROM months
  UNION ALL
  SELECT 'quarter', date_trunc('quarter', first)::date, interval '3 months', closed FROM months
  UNION ALL
  SELECT 'year', date_trunc('year', first)::date, interval '1 year', closed FROM months
)
-- A span's length is its kind's, so it is grouped by its kind and its
-- first day alone.
SELECT CASE kind WHEN 'month' THEN to_char(since, 'YYYY-MM') WHEN 'quarter' THEN to_char(since, 'YYYY-"Q"Q') ELSE to_char(since, 'YYYY') END AS id,
       kind, since, (since + max(length))::date - 1 AS until,
       CASE kind WHEN 'month' THEN to_char(since - max(length), 'YYYY-MM') WHEN 'quarter' THEN to_char(since - max(length), 'YYYY-"Q"Q') ELSE to_char(since - max(length), 'YYYY') END AS before,
       (since - max(length))::date AS before_since, since - 1 AS before_until,
       bool_and(closed IS NOT NULL) AS closed
FROM spans
GROUP BY kind, since;
COMMENT ON VIEW account.report IS 'audience: shared by kind, since: the spans the statements are drawn for, whether each is closed, summed over every period of the books, the same for every reader as the statements are';

GRANT SELECT ON account.rubric, account.report TO cella_app, cella_guards;

COMMENT ON TABLE account.rubric IS 'registry: the rubrics of the statements, the legal form''s';
