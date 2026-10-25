+++
title = "employment-file"
updated = 2026-10-25
+++

A worker's employment records, such as their signed contract and its
amendments: files of class `payroll` about them, kept five years (Code du
travail, art. L3243-4), member or not. Declared by `file`.

## Schema

`employment_file` (`sql/`): `record`, a worker and a file, each by address or
id, a file kept once.

## Writes

`employment-file:worker:attach` (confluent, `hire-worker`): whoever hires
files a worker's record; the log commits to its name and BLAKE3.

## Rules

- `employment_file.files`, on the write: the worker is employed by the co-op,
  and the file was uploaded by this write about them, of class `payroll`.
- `001-employment-file.sql` registers the power, which the `circle-membership`
  graft checks.

## Tests

`ts/_tests/record.test.ts` (`cella test slice employment-file`): a record
filed about a worker opens to them and to who filed it; never about
someone the co-op does not employ.

## Shell

Employment records on a person's page, each opening as its file, and
another filed.

## Lanterne

Inès's contract, filed by Camille as manager.
