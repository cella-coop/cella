-- The payslip feat's analytical contract: each month's payroll summed over
-- every payslip, and its run's days. A payslip is its member's, so no row
-- is one member's pay.
CREATE VIEW payslip.months AS
SELECT p.month, count(*)::bigint AS payslips, coalesce(sum(p.minutes), 0)::bigint AS minutes,
       coalesce(sum(cella.cents(p.gross)), 0)::bigint AS gross,
       coalesce(sum(cella.cents(p.employee)), 0)::bigint AS employee,
       coalesce(sum(cella.cents(p.employer)), 0)::bigint AS employer,
       coalesce(sum(cella.cents(p.net)), 0)::bigint AS net,
       max(r.generated) AS generated, max(r.approved) AS approved, max(r.paid) AS paid
FROM payslip.payslip p
LEFT JOIN payslip.run r ON r.month = p.month
GROUP BY p.month;
COMMENT ON VIEW payslip.months IS 'audience: shared by month';
