+++
title = "file-member"
updated = 2026-10-25
+++

A member's records on file, such as their signed subscription form: files
of class `member-profile` about them, erased with their profile. Declared
by `file`.

## Schema

`file_member` (`sql/`): `record`, a member and a file, each by address or
id, a file kept once.

## Writes

`file-member:member:attach` (confluent, `self`): a member files a record
of their own; the log commits to its name and BLAKE3.

## Rules

- `file_member.files`, on the write: the record is the actor's own, they
  are invited or a member, and the file was uploaded by this write about
  them, of class `member-profile`.

## Tests

`ts/_tests/record.test.ts` (`cella test slice file-member`): a record of
one's own, in the record part, committed to; never someone else's, nor
once one has left.

## Shell

A Records tab on a member's page: the records on their file, each opening
as its file, and another filed.

## Lanterne

Camille's subscription form.
