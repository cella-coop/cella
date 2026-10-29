-- The project-task graft's analytical contract: which project, and which
-- of its milestones, each task is filed under.
CREATE VIEW project_task.filings AS
SELECT f.task, f.project, f.milestone
FROM project_task.filing f;
