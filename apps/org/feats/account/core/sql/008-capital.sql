-- The statutes' capital clauses, in the same terms as the work share's,
-- adopted by the members' decision with them: the value of one share; the
-- fewest shares an associate subscribes; the most monthly instalments
-- they may pay a subscription in; and, for an associate who leaves, the
-- months after the exit before their capital's first repayment and the
-- yearly repayments it is spread over. A SCOP repays a departing
-- associate's shares at their nominal value (loi n° 47-1775 du 10
-- septembre 1947, art. 18) within five years (Avise, « La Scop », 2014:
-- « l'entreprise a cinq années pour rembourser les parts sociales »; the
-- article setting it is not verified on Légifrance, which refuses the
-- box). Terms that say nothing of the capital leave it to earlier terms.
ALTER TABLE account.terms
  ADD COLUMN share cella.amount,
  ADD COLUMN minimum integer CHECK (minimum > 0),
  ADD COLUMN instalments integer CHECK (instalments > 0),
  ADD COLUMN delay integer CHECK (delay >= 0),
  ADD COLUMN repayments integer CHECK (repayments > 0),
  ADD CONSTRAINT terms_capital CHECK (
    (share IS NULL AND minimum IS NULL AND instalments IS NULL AND delay IS NULL AND repayments IS NULL)
    OR (share IS NOT NULL AND minimum IS NOT NULL AND instalments IS NOT NULL AND delay IS NOT NULL AND repayments IS NOT NULL)
  );

-- The terms whose capital clauses govern a day: the adopted terms that
-- state them, from the latest year not after the day's, the latest
-- adopted where two start the same year.
CREATE FUNCTION account.capital_for(day date) RETURNS text
LANGUAGE sql STABLE
RETURN (
  SELECT t.id FROM account.terms t
  WHERE t.adopted IS NOT NULL AND t.share IS NOT NULL AND t."from" <= extract(year FROM day)
  ORDER BY t."from" DESC, t.adopted DESC, t.id DESC
  LIMIT 1
);

-- The day each of a capital's repayments falls due, by the clauses of
-- `terms`, for an associate who left on `exited`: the first `delay`
-- months after the exit, the others a year apart.
CREATE FUNCTION account.repayments(terms text, exited date)
RETURNS TABLE (n integer, due date)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT k.n::integer, (exited + make_interval(months => t.delay + 12 * (k.n::integer - 1)))::date
  FROM account.terms t
  CROSS JOIN LATERAL generate_series(1, t.repayments) AS k (n)
  WHERE t.id = terms AND t.repayments IS NOT NULL
  ORDER BY k.n;
END;

-- account:terms:adopt — as before, and their capital clauses repay a
-- departing associate within five years of the exit.
CREATE OR REPLACE FUNCTION account.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN t.id IS NULL THEN 'no terms ' || coalesce(x.terms, 'are named')
    WHEN t.adopted IS DISTINCT FROM cella.verdict_date() THEN t.id || ' were not adopted by this write'
    WHEN t.salary + t.hours + t.equal <> 100
      THEN t.id || ' divide ' || (t.salary + t.hours + t.equal) || ' % of the work share, not 100 %'
    WHEN EXISTS (SELECT FROM account.allocation a WHERE a.year >= t."from" AND a.allocated IS NOT NULL)
      THEN t.id || ' would govern ' || (SELECT min(a.year) FROM account.allocation a WHERE a.year >= t."from" AND a.allocated IS NOT NULL)
        || ', whose surplus is allocated'
    WHEN t.delay + 12 * (t.repayments - 1) > 60
      THEN t.id || ' repay a departing associate ' || (t.delay + 12 * (t.repayments - 1)) || ' months after the exit: a SCOP repays within five years'
  END
  FROM (SELECT payload ->> 'terms' AS terms) x
  LEFT JOIN account.terms t ON t.id = x.terms;
END;

-- The powers the capital's money writes need: recording what an
-- associate pays in is recording money received; repaying a departed
-- one's capital is money out of the bank, under its own power. Spreading
-- a subscription over instalments is the associate's own.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:capital:pay', 'record-receipt', NULL, 'account'),
  ('account:capital:repay', 'repay-capital', NULL, 'account');
