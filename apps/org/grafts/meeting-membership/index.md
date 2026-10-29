+++
title = "meeting-membership"
updated = 2026-10-30
+++

Who came to a meeting. Declared by the `meeting` feat. Who was expected,
the circle's seats, is `circle-meeting-membership`'s.

## Schema

`meeting_membership` (`sql/`): `meeting_membership.attendance`, a member's mark
at a meeting, present, excused or absent, by their ids, the last mark
winning, with the day and who made it. A trigger refuses a mark at a
meeting no longer scheduled, since holding it fixes who came, reading the
meeting `FOR SHARE` as the agenda's trigger does, and a mark of anyone
who is not an active member on the verdict date (`membership.active`). The app role may select, insert and update;
the rules role, `cella_rules`, may select.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/meeting-membership/attendance.mark` | confluent | a register per member, the last mark winning; fixed by the hold |
| `POST /api/meeting-membership/attendance.record` | confluent | as mark |

- **mark** is a member's own: `check: 'self'`, backed by
  `meeting_membership.marks`. A member not seated in the meeting's circle may
  mark themselves, and comes as a guest, counted in no quorum.
- **record** is the minutes' keeper's, for anyone expected: it needs
  `keep-minutes`, which `circle-meeting-membership` checks reaches the
  meeting's circle, and refuses for a member not seated there.

## Shell

The meeting's page posts both, from `circle-meeting-membership`'s attendance
block; the collection carries how many were present; a person's page
lists the meetings they were marked at.

Slice tests: a mark as a register, fixed once held, only an active
member's, and the self rule.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `meeting_membership.attendance_marked` to the analytics shell: who attended each meeting, as marked.
