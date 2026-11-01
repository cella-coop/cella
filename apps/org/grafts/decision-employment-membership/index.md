+++
title = "decision-employment-membership"
updated = 2026-11-01
+++

A candidate's admission, once their probation is over: the proposal to
the assembly, filled in from their candidacy. Declared by the `worker`
feat. It joins decision, member and worker, reading `decision-membership`
(the decisions that move to admit someone) and `employment-membership` (the
candidacy) beneath it, and writes nothing: the proposal it fills in is
circle-decision-membership's, put to the assembly from the person's page.

## Schema

`decision_employment_membership` (`sql/`): `decision_employment_membership.admission`,
each candidate, employee or invited, with their probation and pledge,
the latest decision moving to admit them, open ones first, and whether a
proposal is due: their probation is over, they are invited, and no open
decision moves to admit them. The app role and the guards role may
select.

## Tests

`ts/_tests/admission.test.ts` (`cella test slice
decision-employment-membership`): due once the probation is over, held back
while a decision is open, and due again once it closes without admitting
them.

## Shell

On an invited candidate's member page, under Joining: while a decision
moves to admit them, which one and until when; once their probation is
over and none does, the proposal to admit them, its shares the ones they
pledged, its deadline two weeks on and its reasons written from their
hire and probation, posted to circle-decision-membership's `propose`.

## Lanterne

Inès's probation ended on 31 August 2026, and d-2026-012 moves to admit
her until 31 October, so her page shows the decision, not the form.
