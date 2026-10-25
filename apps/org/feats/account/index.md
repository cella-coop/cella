+++
title = "Account"
updated = 2026-10-25
+++

The co-op's accounts and what its members own: the chart of accounts,
members' capital accounts, reserves and funds, the periods the books are
kept in, the allocations of each year's surplus, the statutes' terms for
its work share and its capital, each worker's part of the work share, and
the presentation of the financial statements, their rubrics and the spans
they are drawn for.
This is the
co-op-specific layer that generic accounting software lacks. An account
holds no balance of its own: its balance is the sum of the journal lines
posted to it, which the `account-transaction` graft reads from the
`transaction` feat.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| account | `code`, `label`, `kind`, `cash`, `parent?`, `holder?`, `frozen` | `code` is unique in the scope and follows the national chart (the French PCG for a SCOP) |
| period | `month`, `closed?` | one per month of the fiscal year; open until closed, never reopened |
| allocation | `id`, `year`, `surplus`, `basis`, `allocated?` | one per fiscal year's surplus; `basis` is how the work share divides, as its year's terms say: by `salary`, `hours`, `equal` or a `mix` |
| allocation share | `kind`, `percent`, `amount` | `work`, `legal` (the legal reserve), `development` (the development fund) or `interest` (on capital); a share of nothing has no row |
| terms | `id`, `from`, `salary`, `hours`, `equal`, `capital`, `share?`, `minimum?`, `instalments?`, `delay?`, `repayments?`, `adopted?` | the statutes' terms from a year on: how the work share divides, the weights, in percent, by pay, by time worked and in equal parts, adding up to 100, and the percent of an associate's part that buys shares; and the capital's clauses, stated whole or not at all: the value of a share, the fewest shares an associate subscribes, the most monthly instalments they pay them in, the months after an exit before the first repayment and the number of yearly repayments |
| part | `allocation`, `worker`, `basis`, `quantity`, `amount` | a worker's part of an allocation's work share on one basis: what they were paid (cents), the minutes they worked, or one equal part, and the cents it gave them |
| rubric | `id`, `sheet`, `n`, `kind`, `label`, `side?`, `prefixes`, `adds`, `subtracts` | a rubric of the balance sheet or the income statement, in the order the PCG's models list them for a small company: a `heading`; a `line`, gathering the accounts whose code its longest matching prefix names, debit positive on the `debit` side (assets, expenses) and credit positive on the `credit` side (liabilities, income); or a `total`, adding and subtracting other rubrics of its sheet |
| report | `id`, `kind`, `since`, `until`, `before`, `closed` | a span the statements are drawn for, derived from the periods: each month (`2026-10`), quarter (`2026-Q4`) and year (`2026`) holding one, against the span of the same length before it, closed once every period of it is |

An account's `kind` is its place in the books: `asset`, `liability`,
`equity`, `income` or `expense`. Capital accounts, reserves and funds are
equity accounts distinguished by their code: `1013` holds members' paid-up
capital, one account under it per member (`101301`, …), `1012` what they
subscribed and have not paid, owed by them in `4562`, `1061` the legal
reserve, `1068` the development fund, an indivisible reserve; `4567` is
what the co-op owes associates who left (the PCG's accounts, Règlement
ANC n° 2014-03, not verified on Légifrance). A capital
account names its member by address, as text (`holder`); it has no key
into `member`, and the `account-member` graft checks it.

An account marked `cash` holds the co-op's money: the bank, a till. The
chart says which accounts are cash, and the `account-transaction` graft
reads the flag to keep money from leaving one except through the writes
with their own power and limit.

The financial statements present the chart in the PCG's rubrics, the
models of the annual accounts for a small company (Règlement ANC n°
2014-03, the système de base, art. 821-1 ff., not verified on Légifrance).
Each account sits in one rubric of each sheet, the line whose prefix of
its code is longest, and every code of classes 1 to 7 has one: classes 6
and 7 are the income statement's, and on the balance sheet they are the
result of the period, not yet carried to `12` by a closing entry, so every
account is presented once and the balance sheet balances. The fiscal year
is the calendar year.

## Lifecycle

| Thing | States |
|---|---|
| account | open → frozen (a departing member's capital, from the exit on) |
| period | open → closed |
| allocation | drafted → allocated (once, citing the assembly's decision) |
| terms | drafted → adopted (once, citing the members' decision) |

A frozen account never thaws and takes no new draws; what it held is owed
the member in `4567` and repaid on the statutes' schedule. A closed period
takes no new entries, and a correction to it is an entry in the first
open one. An allocated split never changes, nor do its parts, made in the
write that allocates; adopted terms never change, and later terms govern
from their year; terms that state no capital clauses leave the earlier
ones governing the capital.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/account/draw` | bounded, `self` | a member's draw on their own account, spending the draw limit granted in advance |
| `POST /api/account/surplus.allocate` | ordered, `decided` | the assembly's decision splits the surplus, once |
| `POST /api/account/terms.adopt` | ordered, `decided` | the members' decision adopts the statutes' terms, once |
| `POST /api/account/period.close` | ordered | nothing posts into a closed period |
| `POST /api/account/capital.pay` | confluent | money an associate pays in on their subscription, a deposit |
| `POST /api/account/capital.spread` | confluent, `self` | an associate spreads what they owe over monthly instalments from their pay |
| `POST /api/account/capital.repay` | ordered | a departed associate's capital repaid, one repayment, once and in its turn |

- **draw** is bounded because it spends a right granted in advance, the
  member's draw limit, which the `account-member` graft holds. A draw
  within it settles at once and, at rung 2, offline; beyond it, it is
  refused. It posts, so its handler and its rule are the
  `account-member-transaction` graft's.
- **surplus.allocate** cites the assembly's decision approving the split
  (`account-decision`); it settles only if that decision closed and
  passed. It posts the split, so its handler is `account-transaction`'s,
  over this feat's `allocating` spec.
- **terms.adopt** cites the decision that moved to adopt the terms
  (`account-decision`); it settles only if that decision closed and
  passed, and never over a year whose surplus is allocated.
- **period.close** is ordered because it fixes, by receipt order, which
  entries made the period: an entry received after the close's receipt is
  refused for that period.
- **capital.pay** is confluent because a payment in is a deposit: entries
  commute, and what is left to pay is their sum against the
  subscription. At rung 1 the rule refuses one beyond what is owed. It
  posts, so its handler and rule are `account-member-transaction`'s.
- **capital.spread** is the associate's own register, the latest
  standing: no more instalments than the statutes allow. The instalments
  are withheld when a pay run is paid, so its handler and rule are
  `account-member-payslip-transaction`'s.
- **capital.repay** is ordered because a repayment is paid once and after
  the one before it, and not before the day it falls due. It posts, so
  its handler and rule are `account-member-transaction`'s.

## Powers

No role is hard-coded. A write needs a power held through a mandate, and
the holder is whoever holds the role the mandate is granted to.

| Write | Power | Lanterne |
|---|---|---|
| draw | none: the member's own, within their draw limit | every member, 500 € |
| surplus.allocate | none: decided by the assembly | d-2026-006, for 2025 |
| terms.adopt | none: decided by the members | the statutes' `st-2021`, carried over |
| period.close | `close-period` | Julien, as finance |
| capital.pay | `record-receipt` | Julien, as finance |
| capital.spread | none: the associate's own | Inès, once admitted |
| capital.repay | `repay-capital` | Julien, as finance |

`002-powers.sql` registers period.close's power in `cella.power`, and
`008-capital.sql` capital.pay's and capital.repay's; the `circle-member`
graft checks them.

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
- the work share divides as its year's terms say: the year has adopted
  terms, the allocation names their basis, and each basis's parts add up
  to its portion of the work share, to the cent;
- terms divide the whole work share, and are adopted once, never over a
  year already allocated;
- every account of classes 1 to 7 has a rubric on the balance sheet, and
  a total adds and subtracts only rubrics of its own sheet;
- terms state their capital clauses whole or not at all, and repay a
  departing associate within five years of the exit (loi n° 47-1775, art.
  18, the nominal value; the five years as Avise's guide to the SCOP gives
  them, its article not verified);
- a period closes only after the one before it, and once;
- a frozen account stays frozen.

What it does not own:

- that the members approved an allocation: `account-decision`'s;
- that 15 % goes to the legal reserve until it reaches the highest amount
  the capital ever reached (art. 33, 1°): `account-transaction`'s, since
  the reserve and the capital are balances of the journal;
- that nothing posts into a closed period: `account-transaction`'s;
- who holds a capital account, and that it freezes on exit:
  `account-member`'s; what a member subscribes, pays in and draws, and
  their capital moved to `4567` and repaid on exit:
  `account-member-transaction`'s; the instalments withheld from pay:
  `account-member-payslip-transaction`'s;
- each worker's part on a basis: `account-payslip`'s by pay and in equal
  parts, `account-timesheet`'s by time worked, each the graft that knows
  the basis;
- what of a part buys shares and what is paid: `account-member`'s, and
  the shares posted: `account-member-transaction`'s;
- that the members decided the terms: `account-decision`'s.
- the statements' figures, summed from the journal:
  `account-transaction`'s.

## What it does not know

Account knows no transactions, members, decisions, payslips or time. Its
balances, its allocation's approval and postings, its capital accounts'
holders and the parts of its work share arrive through grafts. The work
share never divides by revenue: French law offers a SCOP pay, time worked
and equal parts (Code du travail, art. L3324-5). A deduction for losses
from a repayment, revolving capital and dues are not built, nor are a
fiscal year other than the calendar year, the abridged models, or an
account placed by the sign of its balance, as a bank overdraft is among
the debts.

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
- `account.terms`: the statutes' terms, `stays_adopted` keeping adopted
  ones as they were; `terms_for(year)` names the terms governing a year's
  work share and `capital_for(day)` those whose capital clauses govern a
  day, `repayments(terms, exited)` the day each repayment of an exit falls
  due,
  `basis_of(terms)` what they divide by, and `portion(allocation, basis)`
  the cents of the work share a basis divides, split by the terms'
  weights with `cella.allocate`.
- `account.part`: each worker's part by basis, which `part_fixed` lets in
  only in the write that allocates and never changes after;
  `divided(allocation)` sets each basis's parts against its portion, and
  `account.statement` sums each worker's parts for a year.
- `account.rubric`: the statements' rubrics, seeded with the PCG's;
  `rubric_of(sheet, code)` the line an account is presented in.
- `account.report`: the spans of the books, each with the span before it.
- `account.kind_of(code)`: the kind of account a code's class makes it, by
  the PCG's list of accounts (art. 932-1); an account opened by a write is
  of this kind.

Triggers raise SQLSTATE `09000`. The app role may select, insert accounts
(a capital account opens on admission) and parts, set a period's
`closed`, an account's `frozen`, an allocation's `allocated` and terms'
`adopted`; the rules role,
`cella_rules`, may select.

## Personal data

A capital account's label names its member: personal data of class
`books`, registered by its holder (`006-personal.sql`), which the law
keeps ten years (Code de commerce, art. L123-22). Erasing a member who
has left restricts it until `cella vault sweep` redacts it.

A part's quantity and amount are what a worker was paid or worked and
what it earned them: personal data of class `payroll`, registered by the
worker (`007-patronage.sql`), kept five years (Code du travail, art.
L3243-4) and redacted after.

## Rules

- `account.closes`, on `account:period:close`: the write closed the period
  on the verdict date, after the period ended, and after every period
  before it.
- `account.splits`, on `account:surplus:allocate`: the write allocated the
  split on the verdict date, its year over and closed; the shares add up
  and honour art. 33's floors, citing the article when refused.
- `account.divides`, on `account:surplus:allocate`: the year has adopted
  terms, the allocation names their basis, and each basis's parts add up
  to its portion.
- `account.adopts`, on `account:terms:adopt`: the write adopted the terms
  on the verdict date, their weights add up to 100, no year they would
  govern is allocated, and their clauses repay an exit within five years.

## Handlers

- `close` (ordered): sets the period's `closed` to the verdict date. The
  update takes the period's row, which the graft's trigger reads `FOR
  SHARE`, so a concurrent post waits for the close or sees it.
- `allocating`: the spec that marks an allocation allocated on the verdict
  date, which `account-transaction` wraps with its entry.
- `adopt` (ordered): sets the terms' `adopted` to the verdict date.
- `opening`: the spec that opens, inside a write, the accounts the chart
  lacks, each of its code's kind and under the longest code that begins
  its own; `account-transaction` carries an entry over with it.

## Tests

`core/ts/_tests/allocation.test.ts` (`cella test slice account`): Lanterne's
2025 split passes; a split under the floors, one that misses its surplus
or a percent, a year not over and one with a period open are refused; an
allocation is made once and its split never changes after.
`core/ts/_tests/terms.test.ts`: the terms governing a year and what they
divide by; each basis's portion, adding up to the work share; parts that
add up pass, one missing or a basis the terms do not name is refused;
parts are made only in the write that allocates and never change; terms
that divide less than the whole, or would govern an allocated year, are
refused, and adopted terms never change; the capital's clauses govern
from the latest adopted terms that state them, are stated whole, fall
due a year apart after the delay, and repay within five years.
`core/ts/_tests/report.test.ts`: each account is placed by the longest
prefix of its code on each sheet, every code of classes 1 to 7 has a place
on the balance sheet, a total names only rubrics of its own sheet and a
line its side, and the spans are each month, quarter and year of the
books against the one before.

## Shell

The `accounts` collection, the chart by code; `periods`, the latest month
first, a period's page closing it; and `allocations`, each year's surplus
in a table, an allocation's page showing its split under a Split tab;
`terms`, the statutes' terms by year, adopted or drafted, a term's page
with its capital clauses; and
`statements`, each worker's part of each year's work share, a statement's
page its part basis by basis against each basis's portion and weight.
`reports`, the financial statements by span, the latest ending first, in
a table, a span's page naming its days and the span it is compared with;
its two statements are `account-transaction`'s tabs.
Printed, a page drops the shell and reads as a document. Balances, the trial
balance and each account's ledger are `account-transaction`'s; allocating,
`account-decision`'s form over `account-transaction`'s write.

## Lanterne

- The chart is a part of the PCG: `512` the bank at Crédit Coopératif,
  its one cash account, `401` suppliers, `411` clients, `421` and `431`
  what pay owes, `455` members' current accounts, `706` services, `44571`
  VAT collected, a capital account per member under `1013`, `1012` and
  `4562` for capital called and not paid, and `4567` for what departed
  associates are owed: Paul's 1 500 €, frozen in `101311` since he left.
- July, August and September 2026 are closed; October to December are
  open. Julien closes each month in the first week of the next.
- The statutes' terms, `st-2021`, carried over, divide the work share by
  pay and employ half of each associate's part in shares. A share is
  worth 50 €; an associate subscribes at least 20 and pays them in at most
  10 monthly instalments; one who leaves is repaid a year after the exit,
  in three yearly repayments.
- The 2025 surplus of 61 400 € awaits allocation: d-2026-006 approved its
  split in June, 27 630 € (45 %) to the members for their work, divided
  by pay, 9 210 € (15 %) to the legal reserve, which is under the
  capital, 15 350 € (25 %) to the development fund, and 9 210 € (15 %) as
  interest on capital.
- Each member may draw up to 500 € on their account.
