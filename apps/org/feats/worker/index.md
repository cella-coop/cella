+++
title = "Worker"
updated = 2026-10-25
+++

Everyone the co-op employs, member or not, and their employment: the job,
the contract, the days it runs and the time it asks a week. In a worker
co-op most workers are members, 70 to 85 % of them, but not all: a new
hire works through a probation before the assembly admits them, and some
never ask to join. Membership is the `member` feat's, pay the `payslip`
feat's and time the `timesheet` feat's; this feat holds what makes
someone a worker, so the time they log and the pay they draw rest on
their employment, not on their membership.

## Why a feat of its own

A worker's employment is a collection of its own, as a membership is: it
starts and ends on its own days, a member may hold none (an associate
who is not employed) and a worker may hold no membership (Inès, before
her admission). Folded into `member`, employment would make every hire a
membership; folded into `payslip`, a worker paid outside the runs, or not
yet paid, would not exist. So the feat holds the employment, and grafts
join it to what employment governs: `payslip-worker` (whose pay is),
`timesheet-worker` (whose time is, and logging it by one's employment),
`key-worker` (a hire's first device), `member-worker` (the candidacy and
the path to membership) and `decision-member-worker` (the admission once
the probation is over).

## Entities

| Entity | Fields | Notes |
|---|---|---|
| worker | `address`, `name`, `job`, `contract`, `start`, `until?`, `minutes`, `hired` | `contract` is `permanent`, `fixed-term` or `apprenticeship`; `minutes` is the time a week |

A worker is named by the address they sign with, the same a membership
uses, so the two read as one person without a foreign key. A contract
runs from `start` to `until`, both included; a permanent one runs until
the worker leaves, a fixed-term one or an apprenticeship names its last
day. `hired` is the day the hire was recorded, which may come before the
contract starts.

## Writes

| Write | Label | Power | Why |
|---|---|---|---|
| `POST /api/worker/hire` | confluent | `hire-worker` | a fact; two hires of one worker cannot both stand, whichever comes first, and hires of two commute |

`key-worker` replaces it in the shell with a hire that carries the
worker's first device. Ending a contract, and changing one, are not
built.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| hire | `hire-worker`, no limit | Camille, as gérante |

`002-powers.sql` registers it in `cella.power`, and the `circle-member`
graft checks it. What a hire costs is the salary's, which the `payslip`
feat holds, so the power has no limit.

## Rules

- `worker.hires`, on `worker:worker:hire`: the write recorded the hire on
  the verdict date, with the contract its payload names.
- `worker.employed(address, day)` and `worker.employed_in(address,
  month)`: whether a worker is employed on a day, or on any day of a
  month; the grafts that join employment read them.

## Schema

`worker` (`core/sql/`): `worker.worker`; `worker.employed`,
`worker.employed_in` and `worker.hires`. The app role may select and
insert; the rules role may select.

## Personal data

A worker's name is personal data of class `payroll`, registered by their
address (`003-personal.sql`): the register of the staff keeps it five
years after they leave (Code du travail, art. R1221-26, not verified on
Légifrance, which refuses the box). The address is the pseudonym every
entry names them by; the job and the contract are the co-op's. A hire's
payload commits to the name.

## Tests

`core/ts/_tests/worker.test.ts` (`cella test slice worker`): employed
from the first day to the last, both included, on a day and in a month;
a contract that runs backward, or a fixed-term one with no end, refused;
`worker.hires`.

## Shell

The `workers` collection in Work, a table of everyone employed and those
who left, with their job, contract, start and whether they are employed;
hiring one; and a worker's page with their contract.

## Lanterne

Twelve workers, all on permanent contracts of 35 hours: the four
founders hired on 1 March 2021, everyone else six months to a year
before the assembly admitted them, Paul until he left on 30 November
2025, and Inès, a junior developer hired on 1 September 2025, employed
and not yet a member.
