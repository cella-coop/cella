+++
title = "Employment"
updated = 2026-10-30
+++

A person's employment, member or not: the job, the contract, the days it
runs and the time it asks a week. In a worker co-op most workers are
members, 70 to 85 % of them, but not all: a new hire works through a
probation before the assembly admits them, and some never ask to join.
Employment is nested in `person`, whose core it inherits: who a worker is,
their name and their devices, is the person's. Membership is the
`membership` feat's, its sibling; pay is the `payslip` feat's and time the
`timesheet` feat's. This feat holds what makes someone a worker, so the
time they log and the pay they draw rest on their employment, not on
their membership.

## Why a feat of its own

A worker's employment is a collection of its own, as a membership is: it
starts and ends on its own days, a member may hold none (an associate
who is not employed) and a worker may hold no membership (Inès, before
her admission). Folded into `membership`, employment would make every
hire a membership; folded into `payslip`, a worker paid outside the runs,
or not yet paid, would not exist. So the feat holds the employment beside
the membership, both under the person, and grafts join it to what
employment governs: `employment-payslip` (whose pay is),
`employment-timesheet` (whose time is, and logging it by one's
employment), `employment-project-timesheet` (a worker's week of time),
`employment-file` (their employment records), `employment-membership` (the
candidacy and the path to membership) and `decision-employment-membership`
(the admission once the probation is over).

## Entities

| Entity | Fields | Notes |
|---|---|---|
| worker | `address`, `name`, `job`, `contract`, `start`, `until?`, `minutes`, `hired` | `contract` is `permanent`, `fixed-term` or `apprenticeship`; `minutes` is the time a week |

A worker is named by their person's address. A contract runs from `start`
to `until`, both included; a permanent one runs until the worker leaves, a
fixed-term one or an apprenticeship names its last day. `hired` is the
day the hire was recorded, which may come before the contract starts.
`name` is the register of the staff's copy of the person's name at their
hire, which the register keeps after the person's own may be erased.

## Writes

| Write | Label | Power | Why |
|---|---|---|---|
| `POST /api/employment/hire` | confluent | `hire-worker` | a fact; two hires of one worker cannot both stand, whichever comes first, and hires of two commute |

A hire carries the worker's first device and enrols it in its own
transaction, so a worker signs their own writes from their first day,
member or not. Ending a contract, changing one, and a salary set from the
shell are not built; the salary is the `payslip` feat's.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| hire | `hire-worker`, no limit | Camille, as gérante |

`002-powers.sql` registers it in `cella.power`, and the
`circle-membership` graft checks it. What a hire costs is the salary's,
which the `payslip` feat holds, so the power has no limit.

## Rules

- `employment.hires`, on `employment:worker:hire`: the write recorded the
  hire on the verdict date, with the contract its payload names.
- `employment.carries`, on `employment:worker:hire`: the hire enrolled the
  device its payload names, under the worker's address, on the verdict
  date and by no device; a hire with no device is refused, so no one is
  hired unable to sign.
- `employment.employed(address, day)` and `employment.employed_in(address,
  month)`: whether a worker is employed on a day, or on any day of a
  month; the grafts that join employment read them.

## Schema

`employment` (`core/sql/`): `employment.worker`; `employment.employed`,
`employment.employed_in`, `employment.hires` and `employment.carries`. The
app role may select and insert; the rules role may select.

## Personal data

The register's copy of a worker's name is personal data of class
`payroll`, registered by their address (`003-personal.sql`): the register
of the staff keeps it five years after they leave (Code du travail, art.
R1221-26, not verified on Légifrance, which refuses the box). The person's
own name is the person's, of class `profile`. The address is the
pseudonym every entry names them by; the job and the contract are the
co-op's. A hire's payload commits to the name and the key; the device's
label stays out.

## Handlers

- `hire` (confluent), and `hiring`, the same as a write: brings the person
  in (`entering`, the person's), records the contract on the verdict date
  with the register's copy of the name, and enrols the first device
  (`enrolling`, the person's);
  submits `{ worker, job, contract, start, until, minutes, hired, key,
  name }`, the name committed. The member signs the request with the key
  in lower case, as the payload restates it. A key that is not 32 bytes
  in hex, or one enrolled already, is refused before it reaches the
  notary.

## Tests

`cella test slice employment`: `core/ts/_tests/worker.test.ts`, employed
from the first day to the last, both included, on a day and in a month; a
contract that runs backward, or a fixed-term one with no end, refused;
`employment.hires`. `core/ts/_tests/hire.test.ts`, `employment.carries`:
the hire's device, and a hire with none refused.

## Shell

The employment is its parent's people's, so it adds to the `people`
collection rather than owning one. Each row gains the Worker chip,
employed or left, to filter and group by, with the job, the contract and
the day employed beside it; the New form gains a hire with the worker's
first device, under "Hire". A person's page gains their contract, the
days it runs and the time it asks, and its days in the activity.

## Lanterne

Twelve workers, all on permanent contracts of 35 hours: the four
founders hired on 1 March 2021, everyone else six months to a year
before the assembly admitted them, Paul until he left on 30 November
2025, and Inès, a junior developer hired on 1 September 2025, employed
and not yet a member.

## Analytics

Its [analytical contract](../../../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `employment.workers` to the analytics shell: each worker's job, contract and days, by address; their name is the person feat's.
