-- Each worker's share by salary reads as their part does: the worker, and
-- whoever distributes the surplus. The division runs as its owner over
-- every salary, so each share it shows is the one the approval will make,
-- whoever reads it, and keeps of them only the parts its reader reads, so
-- called alone it shows no more than the view.
ALTER FUNCTION patronage_payslip.division(text) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
COMMENT ON FUNCTION patronage_payslip.division(text) IS 'audience: shared: a share that needs every salary to divide, it keeps each part for the reader the personal row opens it to';

CREATE OR REPLACE VIEW patronage_payslip.work_share AS
SELECT d.id AS distribution, v.worker AS member, v.quantity AS basis, v.cents AS amount
FROM patronage.distribution d
CROSS JOIN LATERAL patronage_payslip.division(d.id) v
WHERE v.basis = 'salary'
  AND ((SELECT cella.sees('patronage')) OR d.circle = ANY ((SELECT cella.circles('patronage'))::text[]) OR v.worker = cella.reader() OR cella.reaches('patronage', v.worker));
COMMENT ON VIEW patronage_payslip.work_share IS 'audience: shared: a share that needs every salary to divide, it keeps each worker''s for the readers their personal row opens it to';
