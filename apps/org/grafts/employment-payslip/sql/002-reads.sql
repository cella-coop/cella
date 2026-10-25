-- A worker's payslips read as their pay does.
ALTER VIEW employment_payslip.slip SET (security_invoker = true);
