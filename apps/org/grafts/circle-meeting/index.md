+++
title = "circle-meeting"
updated = 2026-11-01
+++

A meeting's circle, and how a circle meets. Declared by the `meeting`
feat. A meeting names its circle as text; this graft checks it exists
and keeps each circle's setting. Who is expected, the circle's seats, is
`circle-meeting-membership`'s, since seats are the `circle-membership` graft's.

## Schema

`circle_meeting` (`sql/`): `circle_meeting.setting`, by circle, its
`quorum`, the share of its seats a meeting needs present, in percent,
and `adopts`, whether its minutes bind only once adopted by motion. A
circle with no row needs half its seats and keeps its minutes as
written. A trigger refuses a setting of no circle. The app role and the
guards role, `cella_guards`, may select; settings are seeded, as nothing
writes them yet.

## Guards

- `circle_meeting.meets`, on `meeting:meeting:schedule`: the meeting's
  circle exists.

## Shell

On a meeting's page its circle, linked, and its quorum and how its
minutes bind; on a circle's, its next meeting, its quorum, how its
minutes bind and its latest meetings.

## Lanterne

The assembly needs half its members and adopts its minutes by motion,
at its next session; coordination needs half its seats and keeps its
minutes as written.

Slice tests: a setting's circle and bounds, and the guard.
