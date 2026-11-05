+++
title = "employment-membership-motion"
updated = 2026-11-05
+++

A candidate's admission, once their probation is over: the proposal to
the assembly, filled in from their candidacy. Declared by the `worker`
feat. It joins motion, member and worker, reading `membership-motion`
(the motions that move to admit someone) and `employment-membership` (the
candidacy) beneath it, and writes nothing: the proposal it fills in is
membership-motion's, put to the assembly from the person's page.
An employee who applies by right puts their own: the application,
membership-motion's `apply`, puts the motion to admit them in its
write, so their admission reads that motion and no proposal is due while
it is open.

## Schema

`employment_membership_motion` (`sql/`): `employment_membership_motion.admission`,
each candidate, employee or invited, with their probation and pledge,
the latest motion moving to admit them, open ones first, and whether a
proposal is due: their probation is over, they are invited, and no open
motion moves to admit them. The app role and the guards role may
select. It reads as its reader, and finds the motion through
`employment_membership_motion.admitting()`, which runs as its owner over
every motion that moves to admit someone and keeps each one for whom it
names and for the readers of its circle's motions. So a candidate seated
nowhere, in no circle that reads the assembly's motions, still reads the
motion that moves to admit them.

## Tests

`ts/_tests/admission.test.ts` (`cella test slice
employment-membership-motion`): due once the probation is over, held back
while a motion is open, and due again once it closes without admitting
them.

## Shell

On an invited candidate's member page, under Joining: while a motion
moves to admit them, which one and until when; once their probation is
over and none does, the proposal to admit them, its shares the ones they
pledged, its deadline two weeks on and its reasons written from their
hire and probation, posted to membership-motion's `propose`.

## Lanterne

Inès's probation ended on 31 August 2026, and m-2026-012 moves to admit
her until 31 October, so her page shows the motion, not the form.
