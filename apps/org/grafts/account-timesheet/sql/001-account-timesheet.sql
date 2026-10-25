CREATE SCHEMA account_timesheet;

-- The minutes each member worked in a year, from their approved months
-- only: the basis on which the portion of a surplus's work share that
-- divides by time worked divides (Code du travail, art. L3324-5;
-- BOI-BIC-PTP-10-30, § 280).
CREATE FUNCTION account_timesheet.basis(year integer)
RETURNS TABLE (member text, minutes bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT e.member, sum(e.minutes)::bigint
  FROM timesheet.entry e
  JOIN timesheet.period p ON p.member = e.member AND p.month = timesheet.month_of(e.day)
  WHERE p.approved IS NOT NULL AND e.day >= make_date(basis.year, 1, 1) AND e.day < make_date(basis.year + 1, 1, 1)
  GROUP BY e.member;
END;

-- The portion of an allocation's work share that divides by time worked,
-- split in proportion to each member's approved minutes that year by
-- `cella.allocate`, so the parts add up to it to the cent; a part of
-- nothing has no row.
CREATE FUNCTION account_timesheet.division(ref text)
RETURNS TABLE (worker text, minutes bigint, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  WITH worked AS (
    SELECT b.member, b.minutes, row_number() OVER (ORDER BY b.member) AS n
    FROM account.allocation a
    CROSS JOIN LATERAL account_timesheet.basis(a.year) b
    WHERE a.id = ref AND b.minutes > 0
  ),
  split AS (
    SELECT CASE WHEN account.portion(ref, 'hours') > 0 AND EXISTS (SELECT FROM worked)
      THEN cella.allocate(cella.amount(account.portion(ref, 'hours')), (SELECT array_agg(w.minutes ORDER BY w.n) FROM worked w)) END AS hours
  )
  SELECT w.member, w.minutes, s.hours[w.n] FROM worked w CROSS JOIN split s WHERE s.hours[w.n] > 0;
END;

-- When an allocation is allocated, in that write, its parts by time
-- worked are made, whichever write allocates it.
CREATE FUNCTION account_timesheet.parts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.allocated IS NULL AND NEW.allocated IS NOT NULL THEN
    INSERT INTO account.part (allocation, worker, basis, quantity, amount)
    SELECT NEW.id, d.worker, 'hours', d.minutes, cella.amount(d.cents) FROM account_timesheet.division(NEW.id) d;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER parts_by_time AFTER UPDATE OF allocated ON account.allocation
  FOR EACH ROW EXECUTE FUNCTION account_timesheet.parts();

-- account:surplus:allocate — the allocation's parts by time worked are
-- exactly its portion divided by the members' approved minutes that year.
CREATE FUNCTION account_timesheet.divides(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT d.worker, d.minutes, d.cents FROM account_timesheet.division(a.id) d)
      EXCEPT ALL
      (SELECT p.worker, p.quantity, cella.cents(p.amount) FROM account.part p WHERE p.allocation = a.id AND p.basis = 'hours')
    ) OR EXISTS (
      (SELECT p.worker, p.quantity, cella.cents(p.amount) FROM account.part p WHERE p.allocation = a.id AND p.basis = 'hours')
      EXCEPT ALL
      (SELECT d.worker, d.minutes, d.cents FROM account_timesheet.division(a.id) d)
    ) THEN a.id || '''s parts by time worked are not its portion divided by the minutes approved in ' || a.year
  END
  FROM (SELECT payload ->> 'allocation' AS allocation) x
  JOIN account.allocation a ON a.id = x.allocation;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('account:surplus:allocate', 'account_timesheet.divides(jsonb)', 'account-timesheet');

GRANT USAGE ON SCHEMA account_timesheet TO cella_app, cella_rules;
