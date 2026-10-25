-- Whose a salary and a payslip are is the payslip-worker graft's: a
-- worker's, member or not, employed in the payslip's month. A member who
-- is not employed draws no salary, and a worker who is no member yet is
-- paid as any other, so the check against the members goes, with its
-- triggers.
DROP FUNCTION member_payslip.whose() CASCADE;

-- Each payslip's name is its worker's, payslip-worker's too.
DROP VIEW member_payslip.slip;
