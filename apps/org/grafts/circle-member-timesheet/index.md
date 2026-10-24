+++
title = "circle-member-timesheet"
updated = 2026-10-24
+++

Whose time a power reaches: a lead approves the time of their own
circle's members. Declared by the `circle` feat. It joins circle, member
and timesheet, since what an approval concerns is a member's seats, and
reads `circle-member` beneath it; it has no table of its own, and no
shell.

## Rules

- `circle_member_timesheet.approves`, on `timesheet:period:approve`: the
  approver holds the op's power (`approve-time`) over a circle the
  member sits in on the verdict date, through `circle_member.over`: a
  seat whose role has the mandate, in that circle or one it is within.
  `circle_member.empowered` checks the power itself, for every write; this
  narrows where it reaches.

## Lanterne

Yusuf, Web's lead, approves Thomas's month; Hugo, Brand's, is refused it;
Camille, the gérante, seated in the assembly, approves anyone's. Julien
approves within Operations, as its lead and its finance.

Slice tests: none of its own; the rule is `circle-member`'s `over` and
its tests, and the `governance` scenario.
