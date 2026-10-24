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
| allocation | `id`, `year`, `surplus`, `shares[]` | one per fiscal year's surplus |
| allocation share | `kind`, `percent`, `amount` | `work`, `reserves`, `interest`, or a fund |
| draw | `account`, `amount`, `share` | spends from an account against a share granted in advance |

An account's `kind` is its place in the books: `asset`, `liability`,
`equity`, `income` or `expense`. Capital accounts, reserves and funds are
equity accounts distinguished by their code: `1013` holds members' paid-up
capital, `1061` the legal reserve, `1068` the indivisible reserves. A
capital account names its member by address, as text; it has no key into
`member`.

An account marked `cash` holds the co-op's money: the bank, a till. The
chart says which accounts are cash, and the `account-transaction` graft
reads the flag to keep money from leaving one except through the writes
with their own power and limit (`transaction.pay`, `transaction.payroll`).

## Lifecycle

| Thing | States |
|---|---|
| account | open → frozen (a departing member's capital, until it is repaid) |
| period | open → closed |
| allocation | draft → allocated (when the members' decision settles) |

A frozen account takes no new draws. A closed period takes no new entries,
and a correction to it is an entry in the first open period.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/account/draw` | bounded | from a member's share; beyond it, ordered |
| `POST /api/account/surplus.allocate` | ordered | the assembly's decision splits the surplus |
| `POST /api/account/period.close` | ordered | nothing posts into a closed period |

- **draw** is bounded because it spends a right granted in advance: a
  circle's budget or a member's advance, carved from a mandate's limit. A
  draw within the share settles at once and, at rung 2, offline; a draw
  beyond it needs a fresh grant, which is ordered.
- **surplus.allocate** is ordered and waits on a majority decision of the
  assembly, folded from the signed votes. Two allocations of one year
  cannot both stand.
- **period.close** is ordered because it fixes, by receipt order, which
  entries made the period: an entry received after the close's receipt is
  refused for that period.

## Powers

No role is hard-coded. A write needs a power held through a mandate, and
the holder is whoever holds the role the mandate is granted to.

| Write | Power | Lanterne |
|---|---|---|
| draw | `spend-circle`, up to the mandate's `budget` | each circle lead, 1 000 € a month |
| surplus.allocate | `allocate-surplus`, until the `account-decision` graft ties the assembly's decision to it | `ag`, majority, once decided; no mandate grants the power |
| period.close | `close-period` | Julien, as finance |

`002-powers.sql` registers draw's and period.close's powers in
`cella.power`, `004-allocate.sql` surplus.allocate's, and the
`circle-member` graft checks them. A draw's budget
is not checked yet: it needs the month's draws summed, which comes with
the draw's handler.

## Invariants

The account feat owns the rules about its own collection:

- an allocation's shares add up to its surplus, to the cent;
- the shares honour the legal form's floors; for a SCOP, the work share is
  at least 25 %, the reserves at least 15 %, and interest on capital no
  more than either;
- a period closes only after the one before it, and once;
- a draw never exceeds the share it spends from.

What it does not own:

- that the members approved an allocation: the `account-decision` graft's;
- that nothing posts into a closed period: the `account-transaction`
  graft's, since the entry is a transaction's and the period an account's;
- who a capital account belongs to and when it freezes on exit: a later
  `account-member` graft's; today the holder is text.

## What it does not know

Account knows no transactions, members, decisions or invoices. Its
balances, its allocation's approval and its postings arrive through
grafts. Patronage inputs (hours, wages, revenue per member), buy-in and
buyout schedules, revolving capital and dues belong to later feats and
their grafts (`timesheet`, `payslip`), not here.

## Schema

`account` (`core/sql/`):

- `account.account`: code, label, kind, `cash`, parent, holder (an address, as
  text) and `frozen`.
- `account.period`: a month (`2026-10`) and the date it `closed`; a
  trigger keeps a closed period closed, raising SQLSTATE `09000`.

Allocations and draws are not built yet. The app role may select and set
a period's `closed`; the rules role, `cella_rules`, may select.

## Rules

- `account.closes`, on `account:period:close`: the write closed the period
  on the verdict date, after the period ended, and after every period
  before it.

That nothing posts into a closed period is the `account-transaction`
graft's.

## Handlers

- `close` (ordered): sets the period's `closed` to the verdict date. The
  update takes the period's row, which the graft's trigger reads `FOR
  SHARE`, so a concurrent post waits for the close or sees it.

## Lanterne

- The chart is a part of the PCG: `512` the bank at Crédit Coopératif,
  its one cash account, `401` suppliers, `411` clients, `706` services,
  `44571` VAT collected.
- July, August and September 2026 are closed; October is open. Julien
  closes each month in the first week of the next.
- The 2025 surplus of 61 400 € was allocated in June by d-2026-006:
  27 630 € (45 %) to the members for their work, 24 560 € (40 %) to the
  indivisible reserves, 9 210 € (15 %) as interest on capital.
- Hugo, as Brand's lead, may draw up to 1 000 € for the circle without
  asking.
