-- The membership-task graft's analytical contract: who each task is
-- assigned to.
CREATE VIEW membership_task.assignments AS
SELECT a.task, a.member, a.circle
FROM membership_task.assignment a;
COMMENT ON VIEW membership_task.assignments IS 'audience: scoped by circle';
