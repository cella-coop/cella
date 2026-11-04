CREATE SCHEMA patronage_payslip;

-- What each worker was paid in a year, gross, in cents: their salary in
-- force on the first of each of its months, so none for a month after it
-- ended. The basis on which a surplus's work share divides when the
-- statutes divide it by pay (Code du travail, art. L3324-5).
CREATE FUNCTION patronage_payslip.basis(year integer)
RETURNS TABLE (member text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT s.member, sum(s.gross)::bigint
  FROM generate_series(1, 12) AS m (n)
  CROSS JOIN LATERAL (
    SELECT DISTINCT ON (x.member) x.member, x.until, cella.cents(x.gross) AS gross
    FROM payslip.salary x
    WHERE x."from" <= make_date(basis.year, m.n, 1)
    ORDER BY x.member, x."from" DESC
  ) s
  WHERE s.until IS NULL OR s.until >= make_date(basis.year, m.n, 1)
  GROUP BY s.member;
END;

-- The work share's portions that divide by pay and in equal parts (Code
-- du travail, art. L3324-5): by pay, in proportion to what each was paid,
-- among the workers paid more than nothing in the surplus's year; in
-- equal parts, one each, among every worker with a salary in force on
-- some day of the year, whatever it pays (loi n° 78-763, art. 33, 3°):
-- the salary in force on its first day, unless it ended before, or one
-- from a later day of it. Each portion is split by `cella.allocate`, so
-- its parts add up to it to the cent; a part of nothing has no row.
CREATE FUNCTION patronage_payslip.division(ref text)
RETURNS TABLE (worker text, basis text, quantity bigint, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  WITH paid AS (
    SELECT b.member, b.cents, row_number() OVER (ORDER BY b.member) AS n
    FROM patronage.distribution d
    CROSS JOIN LATERAL patronage_payslip.basis(d.year) b
    WHERE d.id = ref AND b.cents > 0
  ),
  employed AS (
    SELECT e.member, row_number() OVER (ORDER BY e.member) AS n
    FROM (
      SELECT DISTINCT x.member
      FROM patronage.distribution d
      JOIN payslip.salary x ON (x."from" > make_date(d.year, 1, 1) AND x."from" <= make_date(d.year, 12, 31))
        OR ((x.until IS NULL OR x.until >= make_date(d.year, 1, 1))
          AND x."from" = (SELECT max(y."from") FROM payslip.salary y WHERE y.member = x.member AND y."from" <= make_date(d.year, 1, 1)))
      WHERE d.id = ref
    ) e
  ),
  split AS (
    SELECT
      CASE WHEN patronage.portion(ref, 'salary') > 0 AND EXISTS (SELECT FROM paid)
        THEN cella.allocate(cella.amount(patronage.portion(ref, 'salary')), (SELECT array_agg(p.cents ORDER BY p.n) FROM paid p)) END AS salary,
      CASE WHEN patronage.portion(ref, 'equal') > 0 AND EXISTS (SELECT FROM employed)
        THEN cella.allocate(cella.amount(patronage.portion(ref, 'equal')), (SELECT array_agg(1::bigint ORDER BY e.n) FROM employed e)) END AS equal
  )
  SELECT x.member, 'salary', x.cents, s.salary[x.n] FROM paid x CROSS JOIN split s WHERE s.salary[x.n] > 0
  UNION ALL
  SELECT x.member, 'equal', 1::bigint, s.equal[x.n] FROM employed x CROSS JOIN split s WHERE s.equal[x.n] > 0;
END;

-- The division of pay and of equal parts, which the patronage feat asks
-- when a distribution is approved and whose parts it makes in that write.
SELECT patronage.register_division('salary', 'patronage_payslip.division(text)');
SELECT patronage.register_division('equal', 'patronage_payslip.division(text)');

-- patronage:distribution:approve — the distribution's parts by pay and in
-- equal parts are exactly its portions divided among the workers with a
-- salary that year.
CREATE FUNCTION patronage_payslip.divides(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT v.worker, v.basis, v.quantity, v.cents FROM patronage_payslip.division(d.id) v)
      EXCEPT ALL
      (SELECT p.worker, p.basis, p.quantity, cella.cents(p.amount) FROM patronage.part p WHERE p.distribution = d.id AND p.basis IN ('salary', 'equal'))
    ) OR EXISTS (
      (SELECT p.worker, p.basis, p.quantity, cella.cents(p.amount) FROM patronage.part p WHERE p.distribution = d.id AND p.basis IN ('salary', 'equal'))
      EXCEPT ALL
      (SELECT v.worker, v.basis, v.quantity, v.cents FROM patronage_payslip.division(d.id) v)
    ) THEN d.id || '''s parts by pay and in equal parts are not its work share divided among those with a salary in ' || d.year
  END
  FROM (SELECT payload ->> 'distribution' AS distribution) x
  JOIN patronage.distribution d ON d.id = x.distribution;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:distribution:approve', 'patronage_payslip.divides(jsonb)', 'patronage-payslip');

-- Each worker's part of a distribution's work share by pay, as it divides
-- now: before the approval, what it would give; once approved, its parts
-- are the patronage feat's.
CREATE VIEW patronage_payslip.work_share AS
SELECT d.id AS distribution, v.worker AS member, v.quantity AS basis, v.cents AS amount
FROM patronage.distribution d
CROSS JOIN LATERAL patronage_payslip.division(d.id) v
WHERE v.basis = 'salary';

GRANT USAGE ON SCHEMA patronage_payslip TO cella_app, cella_guards;
GRANT SELECT ON patronage_payslip.work_share TO cella_app, cella_guards;
