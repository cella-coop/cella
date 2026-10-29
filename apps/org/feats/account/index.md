+++
title = "Account"
updated = 2026-10-30
+++

The co-op's accounts and what its members own: the chart of accounts,
members' capital accounts, reserves and funds, the periods the books are
kept in, the statutes' terms for its capital, and the presentation of the
financial statements, their rubrics and the spans they are drawn for. A
year's surplus and how it is shared out is the `patronage` feat's.
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
| terms | `id`, `from`, `share`, `minimum`, `instalments`, `delay`, `repayments`, `adopted?` | the statutes' capital clauses from a year on: the value of a share, the fewest shares an associate subscribes, the most monthly instalments they pay them in, the months after an exit before the first repayment and the number of yearly repayments |
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
into `member`, and the `account-membership` graft checks it.

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
| terms | drafted → adopted (once, citing the members' decision) |

A frozen account never thaws and takes no new draws; what it held is owed
the member in `4567` and repaid on the statutes' schedule. A closed period
takes no new entries, and a correction to it is an entry in the first
open one. Adopted terms never change, and later terms govern from their
year.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/account/draw` | bounded, `self` | a member's draw on their own account, spending the draw limit granted in advance |
| `POST /api/account/terms.adopt` | ordered, `decided` | the members' decision adopts the statutes' capital clauses, once |
| `POST /api/account/period.open` | ordered | the month after the latest opens, so entries dated in it post; the next month's opening follows it |
| `POST /api/account/period.close` | ordered | nothing posts into a closed period |
| `POST /api/account/capital.pay` | confluent | money an associate pays in on their subscription, a deposit |
| `POST /api/account/capital.spread` | confluent, `self` | an associate spreads what they owe over monthly instalments from their pay |
| `POST /api/account/capital.repay` | ordered | a departed associate's capital repaid, one repayment, once and in its turn |

- **draw** is bounded because it spends a right granted in advance, the
  member's draw limit, which the `account-membership` graft holds. A draw
  within it settles at once and, at rung 2, offline; beyond it, it is
  refused. It posts, so its handler and its rule are the
  `account-membership-transaction` graft's.
- **terms.adopt** cites the decision that moved to adopt the terms
  (`account-decision`); it settles only if that decision closed and
  passed.
- **period.open** is ordered because the months follow one another with
  no gap: the month after the latest opens only once it is there, as a
  period closes only after the one before it. Opening a month already
  open changes nothing.
- **period.close** is ordered because it fixes, by receipt order, which
  entries made the period: an entry received after the close's receipt is
  refused for that period.
- **capital.pay** is confluent because a payment in is a deposit: entries
  commute, and what is left to pay is their sum against the
  subscription. At rung 1 the rule refuses one beyond what is owed. It
  posts, so its handler and rule are `account-membership-transaction`'s.
- **capital.spread** is the associate's own register, the latest
  standing: no more instalments than the statutes allow. The instalments
  are withheld when a pay run is paid, so its handler and rule are
  `account-membership-payslip-transaction`'s.
- **capital.repay** is ordered because a repayment is paid once and after
  the one before it, and not before the day it falls due. It posts, so
  its handler and rule are `account-membership-transaction`'s.

## Powers

No role is hard-coded. A write needs a power held through a mandate, and
the holder is whoever holds the role the mandate is granted to.

| Write | Power | Lanterne |
|---|---|---|
| draw | none: the member's own, within their draw limit | every member, 500 € |

| terms.adopt | none: decided by the members | the statutes' `st-2021`, carried over |
| period.open | `close-period`: the power that keeps the periods | Julien, as finance |
| period.close | `close-period` | Julien, as finance |
| capital.pay | `record-receipt` | Julien, as finance |
| capital.spread | none: the associate's own | Inès, once admitted |
| capital.repay | `repay-capital` | Julien, as finance |

`002-powers.sql` registers period.close's power in `cella.power`,
`006-terms.sql` capital.pay's and capital.repay's, and `010-period.sql`
period.open's; the `circle-membership` graft checks them.

## Invariants

The account feat owns the rules about its own collection:

- every account of classes 1 to 7 has a rubric on the balance sheet, and
  a total adds and subtracts only rubrics of its own sheet;
- terms are adopted once, and repay a departing associate within five
  years of the exit (loi n° 47-1775, art. 18, the nominal value; the five
  years as Avise's guide to the SCOP gives them, its article not
  verified);
- the periods follow one another with no gap, each month opening after
  the latest or before the first;
- a period closes only after the one before it, and once;
- a frozen account stays frozen.

What it does not own:

- a year's surplus, its split and each worker's part: the `patronage`
  feat's, and that a year is closed before its split is approved,
  `account-patronage`'s;
- that nothing posts into a closed period: `account-transaction`'s;
- who holds a capital account, and that it freezes on exit:
  `account-membership`'s; what a member subscribes, pays in and draws, and
  their capital moved to `4567` and repaid on exit:
  `account-membership-transaction`'s; the instalments withheld from pay:
  `account-membership-payslip-transaction`'s;
- what of a worker's part of the work share buys shares:
  `account-membership-patronage`'s, and the shares credited:
  `account-membership-patronage-transaction`'s;
- that the members decided the terms: `account-decision`'s;
- the statements' figures, summed from the journal:
  `account-transaction`'s.

## What it does not know

Account knows no transactions, members, decisions, distributions,
payslips or time. Its balances and its capital accounts' holders arrive
through grafts. A deduction for losses from a repayment, revolving
capital and dues are not built, nor are a fiscal year other than the
calendar year, the abridged models, or an account placed by the sign of
its balance, as a bank overdraft is among the debts.

## Schema

`account` (`core/sql/`):

- `account.account`: code, label, kind, `cash`, parent, holder (an address,
  as text) and `frozen`; `stays_frozen` keeps a frozen account frozen.
- `account.period`: a month (`2026-10`) and the date it `closed`; a
  trigger keeps a closed period closed.
- `account.terms`: the statutes' capital clauses, `stays_adopted` keeping
  adopted ones as they were; `capital_for(day)` names those that govern a
  day and `repayments(terms, exited)` the day each repayment of an exit
  falls due.- `account.rubric`: the statements' rubrics, seeded with the PCG's;
  `rubric_of(sheet, code)` the line an account is presented in.
- `account.report`: the spans of the books, each with the span before it.
- `account.kind_of(code)`: the kind of account a code's class makes it, by
  the PCG's list of accounts (art. 932-1); an account opened by a write is
  of this kind.

Triggers raise SQLSTATE `09000`. The app role may select, insert accounts
(a capital account opens on admission), set a period's `closed`, an
account's `frozen` and terms' `adopted`; the rules role,
`cella_rules`, may select.

## Personal data

A capital account's label names its member: personal data of class
`books`, registered by its holder (`006-personal.sql`), which the law
keeps ten years (Code de commerce, art. L123-22). Erasing a member who
has left restricts it until `cella vault sweep` redacts it.

## Rules

- `account.opens`, on `account:period:open`: the period exists and the
  months follow one another with no gap.
- `account.closes`, on `account:period:close`: the write closed the period
  on the verdict date, after the period ended, and after every period
  before it.
- `account.adopts`, on `account:terms:adopt`: the write adopted the terms
  on the verdict date, and their clauses repay an exit within five years.

## Handlers

- `open` (ordered): makes the period's row, or keeps it as it is;
  `nextPeriod` names the month after the latest, which the New form
  offers.
- `close` (ordered): sets the period's `closed` to the verdict date. The
  update takes the period's row, which the graft's trigger reads `FOR
  SHARE`, so a concurrent post waits for the close or sees it.
- `adopt` (ordered): sets the terms' `adopted` to the verdict date.
- `opening`: the spec that opens, inside a write, the accounts the chart
  lacks, each of its code's kind and under the longest code that begins
  its own; `account-transaction` carries an entry over with it.

## Tests

`core/ts/_tests/terms.test.ts` (`cella test slice account`): the
capital's clauses govern from the latest adopted terms, are stated
whole, fall due a year apart after the delay, and repay within five
years; adopted terms never change. `core/ts/_tests/report.test.ts`: each
account is placed by the longest prefix of its code on each sheet, every
code of classes 1 to 7 has a place on the balance sheet, a total names
only rubrics of its own sheet and a line its side, and the spans are each
month, quarter and year of the books against the one before.
`core/ts/_tests/periods.test.ts`: the first month opens alone and each
next one after the latest, twice changing nothing; a month leaving a gap
is refused. The e2e scenario `patronage` opens 2027's first month.

## Reads

A capital account, one with a holder, reads for its holder and for whoever holds `repay-capital`, `record-entry`, `carry-books`, `close-period` or `distribute-surplus`, the powers that read capital (`sql/009-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)); every other account, for anyone. The capital grafts' own tables, what is called, paid, drawn and owed, read by the same powers, as `account`. A write's transaction reads every account.

## Shell

The `accounts` collection, the chart by code; `periods`, the latest month
first, its New form opening the month after the latest, and a period's
page closing it; `terms`, the statutes' capital
clauses by year, adopted or drafted, titled Capital terms; and `reports`,
the financial statements by span, the latest ending first, in a table, a
span's page naming its days and the span it is compared with; its two
statements are `account-transaction`'s tabs.
Printed, a page drops the shell and reads as a document. Balances, the trial
balance and each account's ledger are `account-transaction`'s; adopting
terms, `account-decision`'s form over this feat's write.

## Lanterne

- The chart is a part of the PCG: `512` the bank at Crédit Coopératif,
  its one cash account, `401` suppliers, `411` clients, `421` and `431`
  what pay owes, `455` members' current accounts, `706` services, `44571`
  VAT collected, a capital account per member under `1013`, `1012` and
  `4562` for capital called and not paid, and `4567` for what departed
  associates are owed: Paul's 1 500 €, frozen in `101311` since he left.
- July, August and September 2026 are closed; October to December are
  open. Julien closes each month in the first week of the next.
- The statutes' capital terms, `st-2021`, carried over: a share is
  worth 50 €; an associate subscribes at least 20 and pays them in at most
  10 monthly instalments; one who leaves is repaid a year after the exit,
  in three yearly repayments.
- Each member may draw up to 500 € on their account.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes the chart, its periods, the statements' rubrics and the capital terms to the analytics shell, as `account.chart`, `account.periods`, `account.rubrics` and `account.capital_terms`. A capital account is a member's, so the chart shows only the accounts no one holds; what the held ones sum to is account-transaction's.
