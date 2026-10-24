CREATE SCHEMA account_payslip;

-- What each member was paid in a year, gross, in cents: their salary in
-- force on the first of each of its months. The basis on which a surplus's
-- work share divides when the statutes divide it by salary (loi n° 78-763,
-- art. 33, 3°).
CREATE FUNCTION account_payslip.basis(year integer)
RETURNS TABLE (member text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT s.member, sum(s.gross)::bigint
  FROM generate_series(1, 12) AS m (n)
  CROSS JOIN LATERAL (
    SELECT DISTINCT ON (x.member) x.member, cella.cents(x.gross) AS gross
    FROM payslip.salary x
    WHERE x."from" <= make_date(basis.year, m.n, 1)
    ORDER BY x.member, x."from" DESC
  ) s
  GROUP BY s.member;
END;

-- Each member's part of a surplus's work share where it divides by
-- salary, to the cent: the share split in proportion to what each was paid
-- in the surplus's year, by `cella.allocate`, so the parts add up to it.
CREATE VIEW account_payslip.work_share AS
WITH b AS (
  SELECT a.id AS allocation, x.member, x.cents,
         row_number() OVER (PARTITION BY a.id ORDER BY x.member) AS n,
         account.share_of(a.id, 'work') AS work
  FROM account.allocation a
  CROSS JOIN LATERAL account_payslip.basis(a.year) x
  WHERE a.basis = 'salary' AND account.share_of(a.id, 'work') > 0
),
parts AS (
  SELECT allocation, cella.allocate(cella.amount(max(work)), array_agg(cents ORDER BY member)) AS amounts
  FROM b
  GROUP BY allocation
)
SELECT b.allocation, b.member, b.cents AS basis, p.amounts[b.n] AS amount
FROM b JOIN parts p ON p.allocation = b.allocation;

GRANT USAGE ON SCHEMA account_payslip TO cella_app, cella_rules;
GRANT SELECT ON account_payslip.work_share TO cella_app, cella_rules;
