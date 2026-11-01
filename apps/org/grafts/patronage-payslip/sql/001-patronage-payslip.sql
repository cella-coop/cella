CREATE SCHEMA patronage_payslip;

-- What each worker was paid in a year, gross, in cents: their salary in
-- force on the first of each of its months. The basis on which a surplus's
-- work share divides when the statutes divide it by pay (Code du travail,
-- art. L3324-5).
CREATE FUNCTION patronage_payslip.basis(year integer)
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

-- The work share's portions that divide by pay and in equal parts, among
-- the workers paid in the surplus's year (Code du travail, art. L3324-5):
-- by pay, in proportion to what each was paid; in equal parts, one each.
-- Each portion is split by `cella.allocate`, so its parts add up to it to
-- the cent; a part of nothing has no row. Who was paid is what the
-- payslip feat knows: a worker with a salary in force in one of the
-- year's months.
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
  split AS (
    SELECT
      CASE WHEN patronage.portion(ref, 'salary') > 0 AND EXISTS (SELECT FROM paid)
        THEN cella.allocate(cella.amount(patronage.portion(ref, 'salary')), (SELECT array_agg(p.cents ORDER BY p.n) FROM paid p)) END AS salary,
      CASE WHEN patronage.portion(ref, 'equal') > 0 AND EXISTS (SELECT FROM paid)
        THEN cella.allocate(cella.amount(patronage.portion(ref, 'equal')), (SELECT array_agg(1::bigint ORDER BY p.n) FROM paid p)) END AS equal
  )
  SELECT x.member, 'salary', x.cents, s.salary[x.n] FROM paid x CROSS JOIN split s WHERE s.salary[x.n] > 0
  UNION ALL
  SELECT x.member, 'equal', 1::bigint, s.equal[x.n] FROM paid x CROSS JOIN split s WHERE s.equal[x.n] > 0;
END;

-- When a distribution is approved, in that write, its parts by pay and in
-- equal parts are made, whichever write approves it.
CREATE FUNCTION patronage_payslip.parts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.approved IS NULL AND NEW.approved IS NOT NULL THEN
    INSERT INTO patronage.part (distribution, worker, basis, quantity, amount)
    SELECT NEW.id, v.worker, v.basis, v.quantity, cella.amount(v.cents) FROM patronage_payslip.division(NEW.id) v;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER parts_by_pay AFTER UPDATE OF approved ON patronage.distribution
  FOR EACH ROW EXECUTE FUNCTION patronage_payslip.parts();

-- patronage:distribution:approve — the distribution's parts by pay and in
-- equal parts are exactly its portions divided among the workers paid
-- that year.
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
    ) THEN d.id || '''s parts by pay and in equal parts are not its work share divided among those paid in ' || d.year
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
