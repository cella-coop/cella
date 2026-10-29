-- The expense-project graft's analytical contract: which project each
-- expense is rebilled to.
CREATE VIEW expense_project.rebills AS
SELECT r.expense, r.project
FROM expense_project.rebill r;
