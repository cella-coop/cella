-- The expense-project graft's analytical contract: which project each
-- expense is rebilled to.
CREATE VIEW expense_project.rebills AS
SELECT r.expense, r.project
FROM expense_project.rebill r;

-- Each project's expenses in cents: approved and reimbursed, and still
-- pending.
CREATE VIEW expense_project.totals AS
SELECT s.project, s.expenses, s.approved::bigint AS approved, s.pending::bigint AS pending
FROM expense_project.spent s;
