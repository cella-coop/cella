-- The payslip-transaction graft's analytical contract: which entry posted
-- which month's payroll, and on what event.
CREATE VIEW payslip_transaction.postings AS
SELECT p.entry, p.month, p.event
FROM payslip_transaction.posting p;
