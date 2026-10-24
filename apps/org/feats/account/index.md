+++
title = "Account"
updated = 2026-10-24
+++

The co-op's accounts and what its members own: the chart of accounts,
members' capital accounts, reserves and funds, the periods the books are
kept in, and the allocations of each year's surplus. This is the
co-op-specific layer that generic accounting software lacks. An account
holds no balance of its own: its balance is the sum of the journal lines
posted to it, which the `account-transaction` graft reads from the
`transaction` feat.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| account | `code`, `label`, `kind`, `cash`, `parent?`, `holder?`, `frozen` | `code` is unique in the scope and follows the national chart (the French PCG for a SCOP) |
| period | `month`, `closed?` | one per month of the fiscal year; open until closed, never reopened |
| allocation | `id`, `year`, `surplus`, `basis`, `allocated?` | one per fiscal year's surplus; `basis` is how the work share divides: by `salary`, `hours` or `equal` |
| allocation share | `kind`, `percent`, `amount` | `work`, `legal` (the legal reserve), `development` (the development fund) or `interest` (on capital); a share of nothing has no row |

An account's `kind` is its place in the books: `asset`, `liability`,
`equity`, `income` or `expense`. Capital accounts, reserves and funds are
equity accounts distinguished by their code: `1013` holds members' paid-up
capital, one account under it per member (`101301`, …), `1061` the legal
reserve, `1068` the development fund, an indivisible reserve. A capital
account names its member by address, as text (`holder`); it has no key
into `member`, and the `account-member` graft checks it.

An account marked `cash` holds the co-op's money: the bank, a till. The
chart says which accounts are cash, and the `account-transaction` graft
reads the flag to keep money from leaving one except through the writes
with their own power and limit.

## Lifecycle

| Thing | States |
|---|---|
| account | open → frozen (a departing member's capital, until it is repaid) |
| period | open → closed |
| allocation | drafted → allocated (once, citing the assembly's decision) |

A frozen account never thaws and takes no new draws. A closed period
takes no new entries, and a correction to it is an entry in the first
open one. An allocated split never changes.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/account/draw` | bounded, `self` | a member's draw on their own account, spending the draw limit granted in advance |
| `POST /api/account/surplus.allocate` | ordered, `decided` | the assembly's decision splits the surplus, once |
| `POST /api/account/period.close` | ordered | nothing posts into a closed period |

- **draw** is bounded because it spends a right granted in advance, the
  member's draw limit, which the `account-member` graft holds. A draw
  within it settles at once and, at rung 2, offline; beyond it, it is
  refused. It posts, so its handler and its rule are the
  `account-member-transaction` graft's.
- **surplus.allocate** cites the assembly's decision approving the split
  (`account-decision`); it settles only if that decision closed and
  passed. It posts the split, so its handler is `account-transaction`'s,
  over this feat's `allocating` spec.
- **period.close** is ordered because it fixes, by receipt order, which
  entries made the period: an entry received after the close's receipt is
  refused for that period.

## Powers

No role is hard-coded. A write needs a power held through a mandate, and
the holder is whoever holds the role the mandate is granted to.

| Write | Power | Lanterne |
|---|---|---|
| draw | none: the member's own, within their draw limit | every member, 500 € |
| surplus.allocate | none: decided by the assembly | d-2026-006, for 2025 |
| period.close | `close-period` | Julien, as finance |

`002-powers.sql` registers period.close's power in `cella.power`, and the
`circle-member` graft checks it.

## Invariants

The account feat owns the rules about its own collection:

- an allocation's shares add up to its surplus, to the cent, each its
  percent of it;
- the shares honour a SCOP's floors, loi n° 78-763 du 19 juillet 1978,
  art. 33 (text in force since 2 August 2014, checked on Légifrance): the
  work share is at least 25 % of the surplus (3°), and the interest on
  capital exceeds neither what goes to the reserves, the legal reserve and
  the development fund (1° and 2°), nor the work share (4°);
- a surplus is allocated once its year is over and every period of it is
  closed, and once;
- a period closes only after the one before it, and once;
- a frozen account stays frozen.

What it does not own:

- that the members approved an allocation: `account-decision`'s;
- that 15 % goes to the legal reserve until it reaches the highest amount
  the capital ever reached (art. 33, 1°): `account-transaction`'s, since
  the reserve and the capital are balances of the journal;
- that nothing posts into a closed period: `account-transaction`'s;
- who holds a capital account, and that it freezes on exit:
  `account-member`'s; what a member subscribes and draws:
  `account-member-transaction`'s;
- how the work share divides among the members: `account-payslip`'s, by
  salary.

## What it does not know

Account knows no transactions, members, decisions or payslips. Its
balances, its allocation's approval and postings, and its capital
accounts' holders arrive through grafts. Buyout schedules, revolving
capital and dues are not built.

## Schema

`account` (`core/sql/`):

- `account.account`: code, label, kind, `cash`, parent, holder (an address,
  as text) and `frozen`; `stays_frozen` keeps a frozen account frozen.
- `account.period`: a month (`2026-10`) and the date it `closed`; a
  trigger keeps a closed period closed.
- `account.allocation` and `account.share`: a year's surplus, the basis of
  its work share and the day it was allocated, and its shares;
  `stays_allocated` and `share_fixed` keep an allocated split as it was.
  `account.share_of(allocation, kind)` reads a share's cents.

Triggers raise SQLSTATE `09000`. The app role may select, insert accounts
(a capital account opens on admission), set a period's `closed`, an
account's `frozen` and an allocation's `allocated`; the rules role,
`cella_rules`, may select.

## Rules

- `account.closes`, on `account:period:close`: the write closed the period
  on the verdict date, after the period ended, and after every period
  before it.
- `account.splits`, on `account:surplus:allocate`: the write allocated the
  split on the verdict date, its year over and closed; the shares add up
  and honour art. 33's floors, citing the article when refused.

## Handlers

- `close` (ordered): sets the period's `closed` to the verdict date. The
  update takes the period's row, which the graft's trigger reads `FOR
  SHARE`, so a concurrent post waits for the close or sees it.
- `allocating`: the spec that marks an allocation allocated on the verdict
  date, which `account-transaction` wraps with its entry.

## Tests

`core/ts/_tests/allocation.test.ts` (`cella test slice account`): Lanterne's
2025 split passes; a split under the floors, one that misses its surplus
or a percent, a year not over and one with a period open are refused; an
allocation is made once and its split never changes after.

## Shell

The `accounts` collection, the chart by code; `periods`, the latest month
first, a period's page closing it; and `allocations`, each year's surplus
in a table, an allocation's page showing its split. Balances, the trial
balance and each account's ledger are `account-transaction`'s; allocating,
`account-decision`'s form over `account-transaction`'s write.

## Lanterne

- The chart is a part of the PCG: `512` the bank at Crédit Coopératif,
  its one cash account, `401` suppliers, `411` clients, `421` and `431`
  what pay owes, `455` members' current accounts, `706` services, `44571`
  VAT collected, and a capital account per member under `1013`.
- July, August and September 2026 are closed; October to December are
  open. Julien closes each month in the first week of the next.
- The 2025 surplus of 61 400 € awaits allocation: d-2026-006 approved its
  split in June, 27 630 € (45 %) to the members for their work, divided
  by salary, 9 210 € (15 %) to the legal reserve, which is under the
  capital, 15 350 € (25 %) to the development fund, and 9 210 € (15 %) as
  interest on capital.
- Each member may draw up to 500 € on their account.
