+++
title = "member-timesheet"
updated = 2026-10-24
+++

Whose time an entry is: an active member's. The timesheet feat holds the
member's address on each entry, as a decision holds a voter's; this graft
checks it against the members and names them. Declared by `timesheet`.

## Schema

`member_timesheet` (`sql/`):

- `member_timesheet.whose`, a trigger on `timesheet.entry`: an entry's
  member is active (SQLSTATE `09000`); whether the actor may log at all is
  the `log-time` power's.
- `member_timesheet.sheet`: each member's months with their name, and who
  approved each by name.

The app role and the rules role may select. The graft holds no table and
no write of its own.

## Writes

None of its own. From a member's page it offers the timesheet feat's
`timesheet:period:submit` and `timesheet:period:approve` for that member's
months, under the feat's labels, powers and rules.

## Invariants

- an entry is an active member's time.

## Shell

Adds to each entry its member's name, and to the timesheets' dashboard
the hours by member; to a member's page their months, each with its
hours, billable hours, state and approver, submitting an open one when
the acting member is that member and approving a submitted one when
someone else is.

## Lanterne

Every member's September is approved, Yusuf's by Julien, Thomas's by
Yusuf; their Octobers are open.
