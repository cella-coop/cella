-- Each worker's share by salary reads as their part does: the worker, and
-- whoever distributes the surplus. The division itself sees every salary,
-- so each share it shows is the one the approval will make.
CREATE OR REPLACE VIEW patronage_payslip.work_share AS
SELECT d.id AS distribution, v.worker AS member, v.quantity AS basis, v.cents AS amount
FROM patronage.distribution d
CROSS JOIN LATERAL patronage_payslip.division(d.id) v
WHERE v.basis = 'salary'
  AND ((SELECT cella.sees('patronage')) OR v.worker = cella.reader() OR cella.reaches('patronage', v.worker));
