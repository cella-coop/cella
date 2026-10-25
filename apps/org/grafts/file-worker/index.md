+++
title = "file-worker"
updated = 2026-10-25
+++

A worker's employment records, such as their signed contract and its
amendments: files of class `payroll` about them, kept five years (Code du
travail, art. L3243-4), member or not. Declared by `file`.

## Schema

`file_worker` (`sql/`): `record`, a worker and a file, each by address or
id, a file kept once.

## Writes

`file-worker:worker:attach` (confluent, `hire-worker`): whoever hires
files a worker's record; the log commits to its name and BLAKE3.

## Rules

- `file_worker.files`, on the write: the worker is employed by the co-op,
  and the file was uploaded by this write about them, of class `payroll`.
- `001-file-worker.sql` registers the power, which the `circle-member`
  graft checks.

## Tests

`ts/_tests/record.test.ts` (`cella test slice file-worker`): a record
filed about a worker opens to them and to who filed it; never about
someone the co-op does not employ.

## Shell

Employment records on a worker's page, each opening as its file, and
another filed.

## Lanterne

Inès's contract, filed by Camille as manager.
