+++
title = "file-membership"
updated = 2026-11-07
+++

A member's records on file, such as their signed subscription form: files
of class `profile` about them, erased with their profile; and who else
a personal file opens to ([circles](#circles)). Declared by `file`.

## Schema

`file_membership` (`sql/`): `record`, a member and a file, each by address or
id, a file kept once.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
`file_membership.opener` is a registry and names none.

## Actions

`file-membership:member:attach` (confluent, `file-record`, every person's right): a member or an invitee files a record
of their own; the log commits to its name and BLAKE3.

## Guards

- `file_membership.files`, on the write: the record is the actor's own, they
  are invited or a member, and the file was uploaded by this write about
  them, of class `profile`.

## Circles

Who opens a personal file beyond the person it concerns and who uploaded
it: a member whose seat gives them a power over what the file records
(`002-opens.sql` and `003-reads.sql`).

- `file_membership.opener`, the powers that open each class:
  `approve-expense` and `reimburse-expense` open receipts;
  `approve-payroll`, `pay-payroll` and `hire-worker` employment records;
  `invite-member` members' records. `file_membership.opens(id, actor)`
  reads `membership.may` on the verdict date.
- Each opener is also registered as a power that reads its class
  (`cella.reading`), so the file feat's policy lets its holder see the
  file before `opens` opens it.

In the shell it extends the files collection with `allows`: the shell
serves a file's bytes where the file feat's guard or this one opens
them. `ts/_tests/opens.test.ts`: a power over expenses opens receipts
and only receipts, one to hire employment records, and no seat nothing.
In Lanterne, Julien, as finance, opens Sofia's receipt; Camille, as
manager, Inès's contract; Thomas neither.

## Folds

An attachment folds by `file_membership.fold_attach` (`sql/004-folds.sql`,
[folds](../../../../_corpus/doc/architecture.md#folds)): the file stored about the
member by the file feat's fold of `storing`, the write its handler
calls (`file.fold_storing`), its name and bytes as the commitments its
entry keeps, then kept on the member's file.

## Tests

`ts/_tests/record.test.ts` (`cella test slice file-membership`): a record of
one's own, in the record part, committed to; never someone else's, nor
once one has left.

## Shell

A Records tab on a person's page: the records on their file, each opening
as its file, and another filed.

## Lanterne

Camille's subscription form.
