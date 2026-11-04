-- Each worker's share by time worked, before the approval makes it a
-- part, reads as their part does: the worker, and whoever distributes the
-- surplus. The division runs as its owner over everyone's approved time,
-- so each share it shows is the one the approval will make, whoever reads
-- it.
ALTER FUNCTION patronage_timesheet.division(text) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;

CREATE VIEW patronage_timesheet.time_share AS
SELECT d.id AS distribution, v.worker AS member, v.minutes, v.cents AS amount
FROM patronage.distribution d
CROSS JOIN LATERAL patronage_timesheet.division(d.id) v
WHERE (SELECT cella.sees('patronage')) OR d.circle = ANY ((SELECT cella.circles('patronage'))::text[]) OR v.worker = cella.reader() OR cella.reaches('patronage', v.worker);

GRANT SELECT ON patronage_timesheet.time_share TO cella_app, cella_guards;
