+++
title = "circle-membership-timesheet"
updated = 2026-11-01
+++

Whose time a power reaches: a lead approves the time of their own
circle's members. Declared by the `circle` feat. It joins circle, member
and timesheet, since what an approval concerns is a member's seats, and
reads `circle-membership` beneath it; it has no table of its own, and no
shell.

## Guards

- `circle_membership_timesheet.approves`, on `timesheet:period:approve`: the
  approver holds the op's power (`approve-time`) over a circle the
  member sits in on the verdict date, through `circle_membership.over`: a
  seat whose role has the mandate, in that circle or one it is within.
  A worker who is no active member on the verdict date (`membership.active`) sits in no circle, so anyone holding
  `approve-time` approves their time (`002-workers.sql`).
  `circle_membership.empowered` checks the power itself, for every write; this
  narrows where it reaches.

## Lanterne

Yusuf, Web's lead, approves Thomas's month; Hugo, Brand's, is refused it;
Camille, the gérante, seated in the assembly, approves anyone's, and so
does Julien, seated there as treasurer, for the pay run. Julien approves
Inès's months, though she is no member yet.

Slice tests: none of its own; the guard is `circle-membership`'s `over` and
its tests, and the `governance` and `people` scenarios.

## Shell

Adds to the acting member's inbox each month submitted and not yet
approved, of someone else, that they may approve today by the same
reach as `approves`: holding `approve-time` over a circle its member
sits in, or, for a worker who is no active member, holding it at all;
linking to the person's page, which approves it.
