CREATE SCHEMA patronage_timesheet;

-- The minutes each worker worked in a year, from their approved months
-- only: the basis on which the portion of a surplus's work share that
-- divides by time worked divides (Code du travail, art. L3324-5;
-- BOI-BIC-PTP-10-30, § 280).
CREATE FUNCTION patronage_timesheet.basis(year integer)
RETURNS TABLE (member text, minutes bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT e.member, sum(e.minutes)::bigint
  FROM timesheet.entry e
  JOIN timesheet.period p ON p.member = e.member AND p.month = timesheet.month_of(e.day)
  WHERE p.approved IS NOT NULL AND e.day >= make_date(basis.year, 1, 1) AND e.day < make_date(basis.year + 1, 1, 1)
  GROUP BY e.member;
END;

-- The portion of a distribution's work share that divides by time worked,
-- split in proportion to each worker's approved minutes that year by
-- `cella.allocate`, so the parts add up to it to the cent, each on the
-- basis `hours` with its minutes for quantity; a part of nothing has no
-- row.
CREATE FUNCTION patronage_timesheet.division(ref text)
RETURNS TABLE (worker text, basis text, quantity bigint, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  WITH worked AS (
    SELECT b.member, b.minutes, row_number() OVER (ORDER BY b.member) AS n
    FROM patronage.distribution d
    CROSS JOIN LATERAL patronage_timesheet.basis(d.year) b
    WHERE d.id = ref AND b.minutes > 0
  ),
  split AS (
    SELECT CASE WHEN patronage.portion(ref, 'hours') > 0 AND EXISTS (SELECT FROM worked)
      THEN cella.allocate(cella.amount(patronage.portion(ref, 'hours')), (SELECT array_agg(w.minutes ORDER BY w.n) FROM worked w)) END AS hours
  )
  SELECT w.member, 'hours', w.minutes, s.hours[w.n] FROM worked w CROSS JOIN split s WHERE s.hours[w.n] > 0;
END;

-- The division of time worked, which the patronage feat asks when a
-- distribution is approved and whose parts it makes in that write.
SELECT patronage.register_division('hours', 'patronage_timesheet.division(text)');

-- patronage:distribution:approve — the distribution's parts by time
-- worked are exactly its portion divided by the workers' approved minutes
-- that year.
CREATE FUNCTION patronage_timesheet.divides(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT v.worker, v.quantity, v.cents FROM patronage_timesheet.division(d.id) v)
      EXCEPT ALL
      (SELECT p.worker, p.quantity, cella.cents(p.amount) FROM patronage.part p WHERE p.distribution = d.id AND p.basis = 'hours')
    ) OR EXISTS (
      (SELECT p.worker, p.quantity, cella.cents(p.amount) FROM patronage.part p WHERE p.distribution = d.id AND p.basis = 'hours')
      EXCEPT ALL
      (SELECT v.worker, v.quantity, v.cents FROM patronage_timesheet.division(d.id) v)
    ) THEN d.id || '''s parts by time worked are not its portion divided by the minutes approved in ' || d.year
  END
  FROM (SELECT payload ->> 'distribution' AS distribution) x
  JOIN patronage.distribution d ON d.id = x.distribution;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:distribution:approve', 'patronage_timesheet.divides(jsonb)', 'patronage-timesheet');

GRANT USAGE ON SCHEMA patronage_timesheet TO cella_app, cella_guards;
