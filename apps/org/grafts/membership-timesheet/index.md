+++
title = "membership-timesheet"
updated = 2026-11-01
+++

A member's time, as the members see it: none is a suspended or former
member's. The timesheet feat holds the member's address on each entry,
as a decision holds a voter's. Whose time an entry is otherwise, a
worker's within their employment, is `employment-timesheet`'s, and so are
a person's months on their page: member or not, a person logs time by
their employment, and one page shows it once. Declared by `timesheet`.

## Schema

`membership_timesheet` (`sql/`): `membership_timesheet.whose`, a guard on
`timesheet:entry:log`: the entry is no member's who is suspended or has
left. A worker logs by their employment, member or not, through
`employment-timesheet`'s own ops, which this graft does not judge; Inès,
no member before her admission, logs hers so. The graft holds no table,
no view and no write of its own, and has no client or server package.

## Invariants

- an entry logged by the log-time mandate is no suspended or former
  member's.

## Tests

`ts/_tests/whose.test.ts` (`cella test slice membership-timesheet`): a
member suspended or gone is refused; an active member, one invited and a
stranger are not this graft's to refuse; the guard is on the log and no
trigger on the entries.

## Lanterne

No entry is Paul's after his exit on 30 November 2025.
