-- The expense feat's analytical contract: each expense, whose it is, its
-- category, figures and lifecycle. Its label and receipt are personal and
-- are not shared.
CREATE VIEW expense.expenses AS
SELECT e.id, e.member, e.day, e.category, cella.cents(e.net) AS net, cella.cents(e.vat) AS vat,
       e.status, e.submitted, e.decided, e.reimbursed
FROM expense.expense e;
