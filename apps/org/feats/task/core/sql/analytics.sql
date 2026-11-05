-- The task feat's analytical contract: each task, its status, priority and
-- days.
CREATE VIEW task.tasks AS
SELECT t.id, t.title, t.status, t.priority, t.due, t.created, t.completed, t.circle
FROM task.task t;
COMMENT ON VIEW task.tasks IS 'audience: scoped by circle';
