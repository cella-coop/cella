+++
title = "circle-meeting-membership"
updated = 2026-11-03
+++

Who is expected at a meeting, whether it is quorate, and who may act on
it. Declared by the `meeting` feat. It joins circle, meeting and member,
since all three need seats: it reads `circle-membership` for the seats and
what a power covers, `circle-meeting` for the quorum and
`meeting-membership` for the marks, each a graft beneath it. It has no table
of its own.

## Schema

`circle_meeting_membership` (`sql/`):

- `circle_meeting_membership.roll`: for each meeting, the members seated in
  its circle on its day, with their marks, then the members marked who
  are not seated there, its guests.
- `circle_meeting_membership.quorum`: each meeting's seats, the seated
  members present and how many must be, the circle's share of its seats
  rounded up. Guests count for nothing.

## Guards

- `circle_meeting_membership.sits`, on `meeting:item:add`, `:move` and
  `:remove`: the actor holds a seat that counts in the meeting's circle
  on the verdict date (`circle_membership.sits_in`): the participant's `discuss`, which
  `circle_membership.may` finds on any seat, is held there.
- `circle_meeting_membership.reaches`, on `meeting:meeting:schedule`,
  `:hold`, `:cancel` and `:minute` and on
  `meeting-membership:attendance:record`: the actor holds the action's power over
  the meeting's circle (`circle_membership.over`): a lead's, scoped to their own
  circle, covers it alone, and the gérante's, on the whole co-op, every circle.
- `circle_meeting_membership.records`, on `meeting-membership:attendance:record`:
  the member recorded is seated in the meeting's circle on its day; any
  other member marks themselves, as a guest.

Quorum is a reading, not a refusal: a meeting held without it is held,
and reads as inquorate; what it decides is the motions' own guards.

## Shell

On a meeting's page whether it is quorate, and under its agenda the
attendance block: the roll, the acting member marking themselves and,
when their `keep-minutes` covers the circle, recording anyone expected.
In the acting member's inbox, each meeting still scheduled, from today,
that they are expected at and have not marked themselves for.

## Lanterne

Malik, coordination's secretary, records its attendance; he may not
record Thomas, who holds no seat there. Camille schedules coordination's
meetings and the assembly's from the assembly; Yusuf, Web's lead,
schedules Web's and no other's.

Slice tests: the roll on a meeting's day, the quorum, the keeper's guard
and the seat guard.
