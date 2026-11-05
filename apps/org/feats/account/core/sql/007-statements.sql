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
-- so every account is placed once and the balance sheet balances.
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
  ('assets', 'balance', 1, 'heading', 'Actif', NULL, '{}', '{}', '{}'),
  ('fixed', 'balance', 2, 'heading', 'Actif immobilisé', NULL, '{}', '{}', '{}'),
  ('intangible', 'balance', 3, 'line', 'Immobilisations incorporelles', 'debit', '{20,280,290}', '{}', '{}'),
  ('tangible', 'balance', 4, 'line', 'Immobilisations corporelles', 'debit', '{2,21,22,23,281,282,291,292,293}', '{}', '{}'),
  ('financial', 'balance', 5, 'line', 'Immobilisations financières', 'debit', '{26,27,296,297}', '{}', '{}'),
  ('fixed-total', 'balance', 6, 'total', 'Total actif immobilisé', NULL, '{}', '{intangible,tangible,financial}', '{}'),
  ('current', 'balance', 7, 'heading', 'Actif circulant', NULL, '{}', '{}', '{}'),
  ('stocks', 'balance', 8, 'line', 'Stocks et en-cours', 'debit', '{3}', '{}', '{}'),
  ('advances-paid', 'balance', 9, 'line', 'Avances et acomptes versés sur commandes', 'debit', '{4091}', '{}', '{}'),
  ('receivables', 'balance', 10, 'line', 'Clients et comptes rattachés', 'debit', '{41,491}', '{}', '{}'),
  ('other-receivables', 'balance', 11, 'line', 'Autres créances', 'debit', '{4096,4098,425,4287,4387,441,4456,4458,4561,462,465,4687}', '{}', '{}'),
  ('called-capital', 'balance', 12, 'line', 'Capital souscrit et appelé, non versé', 'debit', '{4562}', '{}', '{}'),
  ('securities', 'balance', 13, 'line', 'Valeurs mobilières de placement', 'debit', '{50,590}', '{}', '{}'),
  ('cash', 'balance', 14, 'line', 'Disponibilités', 'debit', '{5,51,53,54}', '{}', '{}'),
  ('prepaid', 'balance', 15, 'line', 'Charges constatées d''avance', 'debit', '{486}', '{}', '{}'),
  ('current-total', 'balance', 16, 'total', 'Total actif circulant', NULL, '{}', '{stocks,advances-paid,receivables,other-receivables,called-capital,securities,cash,prepaid}', '{}'),
  ('assets-total', 'balance', 17, 'total', 'Total de l''actif', NULL, '{}', '{fixed-total,current-total}', '{}'),
  ('liabilities', 'balance', 18, 'heading', 'Passif', NULL, '{}', '{}', '{}'),
  ('equity', 'balance', 19, 'heading', 'Capitaux propres', NULL, '{}', '{}', '{}'),
  ('capital', 'balance', 20, 'line', 'Capital', 'credit', '{101,108}', '{}', '{}'),
  ('premiums', 'balance', 21, 'line', 'Primes d''émission, de fusion, d''apport', 'credit', '{104}', '{}', '{}'),
  ('revaluation', 'balance', 22, 'line', 'Écarts de réévaluation', 'credit', '{105}', '{}', '{}'),
  ('legal-reserve', 'balance', 23, 'line', 'Réserve légale', 'credit', '{1061}', '{}', '{}'),
  ('statutory-reserves', 'balance', 24, 'line', 'Réserves statutaires ou contractuelles', 'credit', '{1063}', '{}', '{}'),
  ('other-reserves', 'balance', 25, 'line', 'Autres réserves', 'credit', '{106,1062,1064,1068}', '{}', '{}'),
  ('carried', 'balance', 26, 'line', 'Report à nouveau', 'credit', '{11}', '{}', '{}'),
  ('to-allocate', 'balance', 27, 'line', 'Résultat à affecter', 'credit', '{12}', '{}', '{}'),
  ('period-result', 'balance', 28, 'line', 'Résultat de la période', 'credit', '{6,7}', '{}', '{}'),
  ('grants', 'balance', 29, 'line', 'Subventions d''investissement', 'credit', '{13}', '{}', '{}'),
  ('regulated', 'balance', 30, 'line', 'Provisions réglementées', 'credit', '{14}', '{}', '{}'),
  ('equity-total', 'balance', 31, 'total', 'Total capitaux propres', NULL, '{}', '{capital,premiums,revaluation,legal-reserve,statutory-reserves,other-reserves,carried,to-allocate,period-result,grants,regulated}', '{}'),
  ('provisions', 'balance', 32, 'line', 'Provisions pour risques et charges', 'credit', '{15}', '{}', '{}'),
  ('debts', 'balance', 33, 'heading', 'Dettes', NULL, '{}', '{}', '{}'),
  ('bank-loans', 'balance', 34, 'line', 'Emprunts et dettes auprès des établissements de crédit', 'credit', '{164,519}', '{}', '{}'),
  ('other-loans', 'balance', 35, 'line', 'Emprunts et dettes financières divers', 'credit', '{1,16,17,455}', '{}', '{}'),
  ('advances-received', 'balance', 36, 'line', 'Avances et acomptes reçus sur commandes', 'credit', '{419}', '{}', '{}'),
  ('suppliers', 'balance', 37, 'line', 'Dettes fournisseurs et comptes rattachés', 'credit', '{401,403,4081}', '{}', '{}'),
  ('tax-social', 'balance', 38, 'line', 'Dettes fiscales et sociales', 'credit', '{421,422,424,427,4282,4286,43,4382,4386,442,443,444,4455,4457,446,447,4482,4486}', '{}', '{}'),
  ('fixed-suppliers', 'balance', 39, 'line', 'Dettes sur immobilisations et comptes rattachés', 'credit', '{404,405,4084}', '{}', '{}'),
  ('other-debts', 'balance', 40, 'line', 'Autres dettes', 'credit', '{4,457,4567,46,4686,509}', '{}', '{}'),
  ('deferred', 'balance', 41, 'line', 'Produits constatés d''avance', 'credit', '{487}', '{}', '{}'),
  ('debts-total', 'balance', 42, 'total', 'Total dettes', NULL, '{}', '{bank-loans,other-loans,advances-received,suppliers,tax-social,fixed-suppliers,other-debts,deferred}', '{}'),
  ('liabilities-total', 'balance', 43, 'total', 'Total du passif', NULL, '{}', '{equity-total,provisions,debts-total}', '{}'),

  ('operating-income', 'income', 1, 'heading', 'Produits d''exploitation', NULL, '{}', '{}', '{}'),
  ('goods-sold', 'income', 2, 'line', 'Ventes de marchandises', 'credit', '{707,7097}', '{}', '{}'),
  ('production-sold', 'income', 3, 'line', 'Production vendue (biens et services)', 'credit', '{70}', '{}', '{}'),
  ('production-stored', 'income', 4, 'line', 'Production stockée', 'credit', '{713}', '{}', '{}'),
  ('production-capitalised', 'income', 5, 'line', 'Production immobilisée', 'credit', '{72}', '{}', '{}'),
  ('subsidies', 'income', 6, 'line', 'Subventions d''exploitation', 'credit', '{74}', '{}', '{}'),
  ('reversals', 'income', 7, 'line', 'Reprises sur amortissements et provisions, transferts de charges', 'credit', '{781,791}', '{}', '{}'),
  ('other-income', 'income', 8, 'line', 'Autres produits', 'credit', '{7,75}', '{}', '{}'),
  ('operating-income-total', 'income', 9, 'total', 'Total des produits d''exploitation', NULL, '{}', '{goods-sold,production-sold,production-stored,production-capitalised,subsidies,reversals,other-income}', '{}'),
  ('operating-expenses', 'income', 10, 'heading', 'Charges d''exploitation', NULL, '{}', '{}', '{}'),
  ('goods-bought', 'income', 11, 'line', 'Achats de marchandises', 'debit', '{607,6087,6097}', '{}', '{}'),
  ('goods-stock', 'income', 12, 'line', 'Variation de stock de marchandises', 'debit', '{6037}', '{}', '{}'),
  ('materials', 'income', 13, 'line', 'Achats de matières premières et autres approvisionnements', 'debit', '{601,602,6081,6082,6091,6092}', '{}', '{}'),
  ('materials-stock', 'income', 14, 'line', 'Variation de stock de matières premières et approvisionnements', 'debit', '{6031,6032}', '{}', '{}'),
  ('external', 'income', 15, 'line', 'Autres achats et charges externes', 'debit', '{60,61,62}', '{}', '{}'),
  ('taxes', 'income', 16, 'line', 'Impôts, taxes et versements assimilés', 'debit', '{63}', '{}', '{}'),
  ('wages', 'income', 17, 'line', 'Salaires et traitements', 'debit', '{64,641,644}', '{}', '{}'),
  ('social', 'income', 18, 'line', 'Charges sociales', 'debit', '{645,646,647,648}', '{}', '{}'),
  ('depreciation', 'income', 19, 'line', 'Dotations aux amortissements et aux provisions', 'debit', '{681}', '{}', '{}'),
  ('other-expenses', 'income', 20, 'line', 'Autres charges', 'debit', '{6,65}', '{}', '{}'),
  ('operating-expenses-total', 'income', 21, 'total', 'Total des charges d''exploitation', NULL, '{}', '{goods-bought,goods-stock,materials,materials-stock,external,taxes,wages,social,depreciation,other-expenses}', '{}'),
  ('operating-result', 'income', 22, 'total', 'Résultat d''exploitation', NULL, '{}', '{operating-income-total}', '{operating-expenses-total}'),
  ('financial-income', 'income', 23, 'line', 'Produits financiers', 'credit', '{76,786,796}', '{}', '{}'),
  ('financial-expenses', 'income', 24, 'line', 'Charges financières', 'debit', '{66,686}', '{}', '{}'),
  ('financial-result', 'income', 25, 'total', 'Résultat financier', NULL, '{}', '{financial-income}', '{financial-expenses}'),
  ('current-result', 'income', 26, 'total', 'Résultat courant avant impôts', NULL, '{}', '{operating-result,financial-result}', '{}'),
  ('exceptional-income', 'income', 27, 'line', 'Produits exceptionnels', 'credit', '{77,787,797}', '{}', '{}'),
  ('exceptional-expenses', 'income', 28, 'line', 'Charges exceptionnelles', 'debit', '{67,687}', '{}', '{}'),
  ('exceptional-result', 'income', 29, 'total', 'Résultat exceptionnel', NULL, '{}', '{exceptional-income}', '{exceptional-expenses}'),
  ('participation', 'income', 30, 'line', 'Participation des salariés aux résultats', 'debit', '{691}', '{}', '{}'),
  ('income-tax', 'income', 31, 'line', 'Impôts sur les bénéfices', 'debit', '{69,695,696,698}', '{}', '{}'),
  ('result', 'income', 32, 'total', 'Bénéfice ou perte', NULL, '{}', '{current-result,exceptional-result}', '{participation,income-tax}');

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

GRANT SELECT ON account.rubric, account.report TO cella_app, cella_guards;

COMMENT ON TABLE account.rubric IS 'registry: the rubrics of the statements, the legal form''s';
