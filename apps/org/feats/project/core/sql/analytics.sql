-- The project feat's analytical contract: each project with its circle,
-- days and budget, and its milestones.
CREATE VIEW project.projects AS
SELECT p.id, p.title, p.circle, p.started, p.due, cella.cents(p.budget) AS budget, p.archived
FROM project.project p;

CREATE VIEW project.milestones AS
SELECT m.project, m.n, m.title, m.due, m.completed
FROM project.milestone m;
