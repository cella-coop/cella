-- Each booked entry reads as its time does; a project's burn, the sum of
-- its time at the co-op's rates, stays everyone's.
ALTER VIEW project_timesheet.costed SET (security_invoker = true);
