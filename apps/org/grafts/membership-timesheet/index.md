+++
title = "membership-timesheet"
updated = 2026-11-04
+++

A member's time, as the members see it: none is a suspended or former
member's. The timesheet feat holds the member's address on each entry,
as a motion holds a voter's. Whose time an entry is otherwise, a
worker's within their employment, is `employment-timesheet`'s, and so are
a person's months on their page: member or not, a worker logs time by
every employee's right, and one page shows it once; and whose time a
power covers ([circles](#circles)). Declared by `timesheet`.

## Schema

`membership_timesheet` (`sql/`): `membership_timesheet.whose`, a guard on
`timesheet:entry:log`: the entry is no member's who is suspended or has
left. A worker who is no member, as Inès before her admission, is not
this graft's to judge, and logs by the same write. The graft holds no table,
no view and no write of its own, and has no client or server package.

## Invariants

- an entry is no suspended or former member's.

## Circles

Whose time a power covers: a lead approves the time of those seated in
their own circle, since what an approval concerns is a worker's seats
(`003-circle.sql` to `005-active.sql`).

- `membership_timesheet.approves`, on `timesheet:period:approve`: the
  approver holds the action's power (`approve-time`) over a circle the
  worker sits in on the verdict date, through `membership.over`: a seat
  whose role has the mandate, its scope covering that circle. Any person
  may sit in a circle, member or not, so a worker who is no member is
  approved by whoever holds `approve-time` over their working circle; a
  worker whose seat counts nowhere on the verdict date
  (`membership.counts`) sits in no circle, and anyone holding
  `approve-time` approves their time. `membership.empowered` checks the
  power itself, for every write; this narrows what it covers.

In the shell, the graft adds to the acting member's inbox each month
submitted and not yet approved, of someone else, that they may approve
today by the same test as `approves`: holding `approve-time` over a
circle its worker sits in, or, for a worker whose seat counts nowhere,
holding it at all; linking to the person's page, which approves it. In
Lanterne, Yusuf, Web's lead, approves Thomas's month, and Inès's, since
she sits in Web; Hugo, Brand's, is refused them; Camille, the gérante,
seated in the assembly by a mandate on the whole co-op, approves
anyone's, and so does Julien, seated there as treasurer, for the pay
run, who approved Inès's September. Its tests are the membership feat's
of `over`, and the `governance` and `people` scenarios.

## Tests

`ts/_tests/whose.test.ts` (`cella test slice membership-timesheet`): a
member suspended or gone is refused; an active member, one invited and a
stranger are not this graft's to refuse; the guard is on the log and no
trigger on the entries.

## Lanterne

No entry is Paul's after his exit on 30 November 2025.
