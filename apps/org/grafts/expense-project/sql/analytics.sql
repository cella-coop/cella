-- The expense-project graft's analytical contract: which project each
-- expense is rebilled to.
CREATE VIEW expense_project.rebills AS
SELECT r.expense, r.project, r.circle
FROM expense_project.rebill r;
COMMENT ON VIEW expense_project.rebills IS 'audience: scoped by circle';

-- Each project's expenses in cents: approved and reimbursed, and still
-- pending.
CREATE VIEW expense_project.totals AS
SELECT s.project, s.expenses, s.approved::bigint AS approved, s.pending::bigint AS pending
FROM expense_project.spent s;
COMMENT ON VIEW expense_project.totals IS 'audience: shared by project';

-- What each person filed on each project, approved or pending, which the
-- port reads to withhold a project too few people or one or two of them
-- spent for, and no report reads.
CREATE VIEW expense_project.totals_contributions AS
SELECT r.project, e.member AS person, e.circle, coalesce(sum(expense.total(e)) FILTER (WHERE e.status IN ('draft', 'submitted', 'approved', 'reimbursed')), 0)::bigint AS amount
FROM expense_project.rebill r
JOIN expense.expense e ON e.id = r.expense
GROUP BY r.project, e.member, e.circle;
COMMENT ON VIEW expense_project.totals_contributions IS 'audience: contributions to expense_project.totals, read by expense';
COMMENT ON COLUMN expense_project.totals_contributions.person IS 'personal: who filed it, which only the port reads';
