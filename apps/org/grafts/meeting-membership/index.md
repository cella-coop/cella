+++
title = "meeting-membership"
updated = 2026-11-13
+++

Who came to a meeting, who was expected, the circle's seats on its day,
and whether it was quorate ([circles](#circles)). Declared by the
`meeting` feat.

## Schema

`meeting_membership` (`sql/`): `meeting_membership.attendance`, a member's mark
at a meeting, present, excused or absent, by their ids, the last mark
winning, with the day and who made it. A trigger refuses a mark at a
meeting no longer scheduled, since holding it fixes who came, reading the
meeting `FOR SHARE` as the agenda's trigger does, and a mark of anyone
who is not an active member on the verdict date (`membership.active`). The app role may select, insert and update;
the guards role, `cella_guards`, may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/meeting-membership/attendance.mark` | confluent | a register per member, the last mark winning; fixed by the hold |
| `POST /api/meeting-membership/attendance.record` | confluent | as mark |

- **mark** is a member's own: `mark-attendance`, every member's right, and
  `meeting_membership.marks` that it is theirs. A member not seated in the meeting's circle may
  mark themselves, and comes as a guest, counted in no quorum.
- **record** is the minutes' keeper's, for anyone expected: it needs
  `keep-minutes` by a mandate covering the meeting's circle, which its
  payload names for core's guard on every power, and `meeting-membership`
  refuses it for a member not seated there.

## Folds

A mark and a record fold alike by `sql/005-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
the member's mark at the meeting, as the entry names it, the last
winning, made on the entry's day by its actor. The graft's trigger
judges it again as it folds, as it did when it was written.

## Shell

The meeting's page posts both, from `meeting-membership`'s attendance
block; the collection carries how many were present; a person's page
lists the meetings they were marked at.

Slice tests: a mark as a register, fixed once held, only an active
member's, and the self guard.

## Circles

Who is expected at a meeting, whether it is quorate, and who may act on
it: it reads core's seats, the membership feat for whether a seat
counts and what a power covers, the meeting feat for the quorum, and
this graft's marks (`003-roll.sql` and `004-seated.sql`, and in the
shell `meeting-membership/circles`, `api/circles.ts` and
`app/circles.ts`). It adds no table.

- `meeting_membership.roll`: for each meeting, the members seated in
  its circle on its day, with their marks, then the members marked who
  are not seated there, its guests. It reads as its reader.
- `meeting_membership.quorum`: each meeting's seats, the seated
  members present and how many must be, the circle's share of its seats
  rounded up. Guests count for nothing. It reads as its reader.

### Guards of the roll

- `meeting_membership.sits`, on `meeting:item:add`, `:move` and
  `:remove`: the actor holds a seat that counts in the meeting's circle
  on the verdict date (`circle_person.sits_in`): the participant's `discuss`, which
  `circle_person.may` finds on any seat, is held there.
- Whose meetings a power covers is the meeting's owning circle, which
  core's one guard on every power reads from the payload
  ([who may act](../../core/grafts/circle-person/index.md#who-may-act)):
  an attendance record names its meeting's circle, as the meeting feat's
  own writes do, so a lead's or secretary's `keep-minutes`, scoped to
  their own circle, covers it alone, and the manager's, on the whole
  co-op, every circle.
- `meeting_membership.records`, on `meeting-membership:attendance:record`:
  the member recorded is seated in the meeting's circle on its day; any
  other member marks themselves, as a guest.

Quorum is a reading, not a refusal: a meeting held without it is held,
and reads as inquorate; what it decides is the motions' own guards.

### The roll in the shell

On a meeting's page whether it is quorate, and under its agenda the
attendance block: the roll, the acting member marking themselves and,
when their `keep-minutes` covers the circle, recording anyone expected.
In the acting member's inbox, each meeting still scheduled, from today,
that they are expected at and have not marked themselves for.

### The roll in Lanterne

Malik, coordination's secretary, records its attendance; he may not
record Thomas, who holds no seat there. Camille schedules coordination's
meetings and the assembly's from the assembly; Yusuf, Web's lead,
schedules Web's and no other's.

Slice tests: the roll on a meeting's day, the quorum, the keeper's guard
and the seat guard.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `meeting_membership.attendance_marked` to the analytics shell: who attended each meeting, as marked. It is scoped by `circle`, the circle that owns each row. Its view is declared a published query, in `ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
