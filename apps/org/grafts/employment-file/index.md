+++
title = "employment-file"
updated = 2026-11-19
+++

A worker's employment records, such as their signed contract and its
amendments: files of class `payroll` about them, kept five years (Code du
travail, art. L3243-4), member or not. Declared by `file`.

## Schema

`employment_file` (`sql/`): `record`, a worker and a file, each by address or
id, a file kept once.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

`employment-file:worker:attach` (confluent, `hire-worker`): whoever hires
files a worker's record; the log commits to its name and BLAKE3.

## Guards

- `employment_file.files`, on the write: the worker is employed by the coop,
  and the file was uploaded by this write about them, of class `payroll`.
- `001-employment-file.sql` registers the power, which the membership
  feat checks.

## Folds

An attachment folds by `employment_file.fold_attach` (`sql/002-folds.sql`,
[folds](../../../../_corpus/doc/architecture.md#folds)): the file stored about the
worker by the file feat's fold of `storing`, the write its handler
calls (`file.fold_storing`), its name and bytes as the commitments its
entry keeps, then kept on the worker's file.

## Tests

`ts/_tests/record.test.ts` (`cella test slice employment-file`): a record
filed about a worker opens to them and to who filed it; never about
someone the coop does not employ.

## Shell

Employment records in a person's Work tab, each opening as its
file, and another filed.

## Lanterne

Inès's contract, filed by Camille as manager.
