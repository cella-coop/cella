+++
title = "circle-file-membership"
updated = 2026-10-25
+++

Who opens a personal file beyond the person it concerns and who uploaded
it: a member whose seat gives them a power over what the file records.
Only this graft sees both seats and files. Declared by `file`.

## Schema

`circle_file_membership` (`sql/`): `opener`, the powers that open each class:
`approve-expense` and `reimburse-expense` open receipts; `approve-payroll`,
`pay-payroll` and `hire-worker` employment records; `invite-member`
members' records. `circle_file_membership.opens(id, actor)` reads
`circle_membership.may` on the verdict date.

## Shell

Extends the files collection with `allows`: the shell serves a file's
bytes where the file feat's rule or this one opens them.

## Tests

`ts/_tests/opens.test.ts` (`cella test slice circle-file-membership`): a power
over expenses opens receipts and only receipts, one to hire employment
records, and no seat nothing.

## Lanterne

Julien, as finance, opens Sofia's receipt; Camille, as manager, Inès's
contract; Thomas neither.
