-- The work share's portions that divide by pay and in equal parts, among
-- the workers paid in the surplus's year (Code du travail, art. L3324-5):
-- by pay, in proportion to what each was paid; in equal parts, one each.
-- Each portion is split by `cella.allocate`, so its parts add up to it to
-- the cent; a part of nothing has no row. Who was paid is what the
-- payslip feat knows: a worker with a salary in force in one of the
-- year's months.
CREATE FUNCTION account_payslip.division(ref text)
RETURNS TABLE (worker text, basis text, quantity bigint, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  WITH paid AS (
    SELECT b.member, b.cents, row_number() OVER (ORDER BY b.member) AS n
    FROM account.allocation a
    CROSS JOIN LATERAL account_payslip.basis(a.year) b
    WHERE a.id = ref AND b.cents > 0
  ),
  split AS (
    SELECT
      CASE WHEN account.portion(ref, 'salary') > 0 AND EXISTS (SELECT FROM paid)
        THEN cella.allocate(cella.amount(account.portion(ref, 'salary')), (SELECT array_agg(p.cents ORDER BY p.n) FROM paid p)) END AS salary,
      CASE WHEN account.portion(ref, 'equal') > 0 AND EXISTS (SELECT FROM paid)
        THEN cella.allocate(cella.amount(account.portion(ref, 'equal')), (SELECT array_agg(1::bigint ORDER BY p.n) FROM paid p)) END AS equal
  )
  SELECT x.member, 'salary', x.cents, s.salary[x.n] FROM paid x CROSS JOIN split s WHERE s.salary[x.n] > 0
  UNION ALL
  SELECT x.member, 'equal', 1::bigint, s.equal[x.n] FROM paid x CROSS JOIN split s WHERE s.equal[x.n] > 0;
END;

-- When an allocation is allocated, in that write, its parts by pay and in
-- equal parts are made, whichever write allocates it.
CREATE FUNCTION account_payslip.parts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.allocated IS NULL AND NEW.allocated IS NOT NULL THEN
    INSERT INTO account.part (allocation, worker, basis, quantity, amount)
    SELECT NEW.id, d.worker, d.basis, d.quantity, cella.amount(d.cents) FROM account_payslip.division(NEW.id) d;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER parts_by_pay AFTER UPDATE OF allocated ON account.allocation
  FOR EACH ROW EXECUTE FUNCTION account_payslip.parts();

-- account:surplus:allocate — the allocation's parts by pay and in equal
-- parts are exactly its portions divided among the workers paid that
-- year.
CREATE FUNCTION account_payslip.divides(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT d.worker, d.basis, d.quantity, d.cents FROM account_payslip.division(a.id) d)
      EXCEPT ALL
      (SELECT p.worker, p.basis, p.quantity, cella.cents(p.amount) FROM account.part p WHERE p.allocation = a.id AND p.basis IN ('salary', 'equal'))
    ) OR EXISTS (
      (SELECT p.worker, p.basis, p.quantity, cella.cents(p.amount) FROM account.part p WHERE p.allocation = a.id AND p.basis IN ('salary', 'equal'))
      EXCEPT ALL
      (SELECT d.worker, d.basis, d.quantity, d.cents FROM account_payslip.division(a.id) d)
    ) THEN a.id || '''s parts by pay and in equal parts are not its work share divided among those paid in ' || a.year
  END
  FROM (SELECT payload ->> 'allocation' AS allocation) x
  JOIN account.allocation a ON a.id = x.allocation;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('account:surplus:allocate', 'account_payslip.divides(jsonb)', 'account-payslip');

-- Each member's part of an allocation's work share by pay, as it divides
-- now: before the allocation, what it would give; once allocated, its
-- parts are the account feat's.
CREATE OR REPLACE VIEW account_payslip.work_share AS
SELECT a.id AS allocation, d.worker AS member, d.quantity AS basis, d.cents AS amount
FROM account.allocation a
CROSS JOIN LATERAL account_payslip.division(a.id) d
WHERE d.basis = 'salary';

GRANT SELECT ON account_payslip.work_share TO cella_app, cella_rules;
