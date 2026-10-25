+++
title = "key-worker"
updated = 2026-10-25
+++

A worker's devices, from the first one their hire carries. Declared by
the `worker` feat. A member's first device comes with their invitation
and waits for their admission (`key-member`); a worker's comes with
their hire and is enrolled at once, so a worker who is no member signs
their own time from their first day.

## Rules

- `key_worker.carries`, on `worker:worker:hire`: the hire enrolled the
  device its payload names, under the worker's address, on the verdict
  date and by no device. A hire with no device is refused, so no one is
  hired unable to sign.

The hire's payload commits to the key, so the log says which device the
hire enrolled; the label is the worker's wording and stays out. The
graft holds no table: the device is the `key` feat's, in its keyring.

## Handlers

- `hire` (confluent): the worker feat's `hiring`, then the device it
  carries, enrolled on the verdict date, in one write under the worker
  feat's op; submits `{ worker, job, contract, start, until, minutes,
  hired, key }` with the name marked personal. A key that is not 32 bytes
  in hex, or one enrolled already, is refused before it reaches the
  notary.

## Tests

`ts/_tests/hire.test.ts` (`cella test slice key-worker`): a hire carries
the device it enrolled, and one with none, or another, is refused.

## Shell

Replaces the workers collection's New form and its `hire` write with the
hire carrying a first device: name, address, job, contract, its days,
the hours a week, the device's label and its key. On a worker's page,
every device enrolled under their address, as the key feat lists them.

## Lanterne

Inès's laptop was enrolled with her hire on 1 September 2025; her phone,
which her invitation carries, waits for her admission.
