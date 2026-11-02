+++
title = "circle-membership-timesheet"
updated = 2026-11-02
+++

Whose time a power reaches: a lead approves the time of those seated in
their own circle. Declared by the `circle` feat. It joins circle,
membership and timesheet, since what an approval concerns is a worker's
seats, and reads `circle-membership` beneath it; it has no table of its
own, and no shell.

## Guards

- `circle_membership_timesheet.approves`, on `timesheet:period:approve`: the
  approver holds the action's power (`approve-time`) over a circle the
  worker sits in on the verdict date, through `circle_membership.over`: a
  seat whose role has the mandate, in that circle or one it is within.
  Any person may sit in a circle, member or not, so a worker who is no
  member is approved by whoever holds `approve-time` over their working
  circle; a worker whose seat counts nowhere on the verdict date
  (`circle_membership.counts`) sits in no circle, and anyone holding
  `approve-time` approves their time (`003-active.sql`).
  `circle_membership.empowered` checks the power itself, for every write; this
  narrows where it reaches.

## Lanterne

Yusuf, Web's lead, approves Thomas's month, and Inès's, since she sits
in Web; Hugo, Brand's, is refused them; Camille, the gérante, seated in
the assembly, approves anyone's, and so does Julien, seated there as
treasurer, for the pay run, who approved Inès's September.

Slice tests: none of its own; the guard is `circle-membership`'s `over` and
its tests, and the `governance` and `people` scenarios.

## Shell

Adds to the acting member's inbox each month submitted and not yet
approved, of someone else, that they may approve today by the same
reach as `approves`: holding `approve-time` over a circle its worker
sits in, or, for a worker whose seat counts nowhere, holding it at all;
linking to the person's page, which approves it.
