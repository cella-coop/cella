+++
title = "Patronage"
updated = 2026-11-01
+++

The year-end cycle of a worker co-op's surplus: the statutes' terms for
the work share, each financial year's distribution of its surplus, the
split the law and the statutes make of it, each worker's part of the
work share, and the lifecycle that takes a distribution from a draft to
the assembly's approval and on to the books. This is what profile 1.1
keeps in a spreadsheet at year end, opaque to the members
([users](../../../../_corpus/doc/users.md)); here every figure is a rule
anyone can replay from the log.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| terms | `id`, `from`, `salary`, `hours`, `equal`, `capital`, `interest`, `adopted?` | the statutes' terms for the work share from a year on: the weights, in percent, by which it divides by pay, by time worked and in equal parts, adding up to 100, the percent of an associate's part that buys shares, and the highest rate of interest, in percent, the capital earns; terms with no rate pay none |
| distribution | `id`, `year`, `surplus`, `basis`, `approved?`, `distributed?` | one per financial year's surplus; `basis` is how the work share divides, as its year's terms say: by `salary`, `hours`, `equal` or a `mix` |
| share | `kind`, `percent`, `amount` | `work`, `legal` (the legal reserve), `development` (the development fund) or `interest` (on capital); a share of nothing has no row |
| part | `distribution`, `worker`, `basis`, `quantity`, `amount` | a worker's part of a distribution's work share on one basis: what they were paid (cents), the minutes they worked, or one equal part, and the cents it gave them |
| statement | `id`, `distribution`, `year`, `worker`, `amount`, `salary`, `hours`, `equal` | a worker's part of a year's work share, in all and by basis: a view of the parts |

A SCOP gives at least 25 % of its surplus to all its employees,
associates or not, who count in it at the year's close (loi n° 78-763,
art. 33, 3°; BOI-BIC-PTP-10-30, § 90), divided in proportion to pay, to
time worked, in equal parts, or by a mix of these (Code du travail, art.
L3324-5; BOI-BIC-PTP-10-30, § 170 and 280). The work share never divides
by revenue, which the law does not offer. Employing a part in shares is
reserved to the associates employed in the co-op (art. R3323-11), and
what is employed so is blocked five years from the first day of the
sixth month after the year (art. L3324-10). The interest on capital is
at most the rate the statutes set, which the law caps at the average of
the rates of return on private companies' bonds (the TMO) the minister
published in the three calendar years before the assembly, plus two
points (loi n° 47-1775 du 10 septembre 1947, art. 14): 5,36 % for an
assembly in 2026, from the Trésor's six rates published in 2023 to 2025
(3,14, 3,37, 3,18, 3,26, 3,525 and 3,705 %). The
fiscal year is the calendar year.

## Lifecycle

| Thing | States |
|---|---|
| terms | drafted → adopted (once, citing the members' motion) |
| distribution | draft → approved (by the assembly, once its year is closed) → distributed (posted, once, by the write that follows the approval) |
| part | made (by the approval) → employed (its shares credited, once, by the write that follows the distribution; an associate's alone) |

An approved split never changes, nor do its parts, made in the write that
approves it. A distributed one never changes again: its entry is in the
books, and the shares its parts buy are credited by the writes that follow
it, each once. Adopted terms never
change, and later terms govern from their year, never over a year whose
distribution is approved.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/patronage/terms.draft` | confluent | finance drafts the terms for the members to adopt; drafted again, the latest stands until they are adopted |
| `POST /api/patronage/terms.adopt` | ordered, `decided` | the members' motion adopts the work share's terms, once |
| `POST /api/patronage/distribution.draft` | confluent | finance drafts a year's split for the assembly to approve; drafted again, the latest stands until it is approved |
| `POST /api/patronage/distribution.approve` | ordered, `decided` | the assembly's motion approves the split, once, and fixes each worker's part |
| `POST /api/patronage/distribution.distribute` | ordered, `decided` | the approved split posted to the books, once, following the approval and citing its motion |
| `POST /api/patronage/part.employ` | ordered, `decided` | what an associate's part buys in shares credited to their capital, once, following the distribution and citing its motion |

- **terms.draft** and **distribution.draft** are registers: a draft is
  `st-<year>` for terms, the year for a split, and drafting it again
  replaces it, the latest standing, until it is adopted or approved, after
  which it never changes. Terms divide the whole work share
  (`patronage.drafts_terms`). A split's shares make the whole surplus,
  split from it to the cent with `cella.allocate`, under the basis of the
  adopted terms governing its year (`patronage.drafts`); the law's
  floors are judged at its approval. Percents are sent in hundredths.
- **terms.adopt** cites the motion that moved to adopt the terms
  (`motion-patronage`); it settles only if that motion closed and
  passed, and never over a year whose distribution is approved.
- **distribution.approve** cites the assembly's motion approving the
  split (`motion-patronage`); it settles only if that motion closed
  and passed, the year is over and its books closed (`account-patronage`).
  In the same write, the grafts that know each basis make the workers'
  parts (`patronage-payslip`, `patronage-timesheet`), and their guards
  check them.
- **distribution.distribute** is ordered because the split is posted
  once, after its approval. It follows the approval as a write of its
  own, signed by whoever signed the approval and citing the same motion
  (`motion-patronage`), so it settles only if that motion closed, passed
  and approved this split. Its handler is `patronage-transaction`'s,
  which wraps this feat's `distributing` spec with the entry and reacts
  to the approval with it.
- **part.employ** is ordered because a part buys shares once. It follows
  the distribution as a write of its own for each associate whose part
  buys some, signed and citing the motion as the distribution is. Its
  handler is `account-membership-patronage-transaction`'s, which posts
  the credit, records it and adds the shares to what the associate holds.
  A refused one leaves the distribution and every credit before it
  settled, and says why; what it would have bought stays owed in `424`.

## Powers

No role is hard-coded. A write needs a power held through a mandate, and
the holder is whoever holds the role the mandate is granted to.

| Action | Power | Lanterne |
|---|---|---|
| terms.draft, distribution.draft | `distribute-surplus` | Julien, as finance |
| terms.adopt | none: decided by the members | the statutes' `st-2021`, carried over |
| distribution.approve | none: decided by the assembly | m-2026-006, for 2025 |
| distribution.distribute, part.employ | none: they follow the approval, citing its motion | whoever signed the approval: Camille, for 2025 |

`006-draft.sql` registers the drafts' power in `cella.power`; the
`circle-membership` graft checks it.

## Invariants

The patronage feat owns the guards about its own collection:

- a distribution's shares add up to its surplus, to the cent, each its
  percent of it;
- the shares honour a SCOP's floors, loi n° 78-763 du 19 juillet 1978,
  art. 33 (text in force since 2 August 2014, checked on Légifrance): the
  work share is at least 25 % of the surplus (3°), and the interest on
  capital exceeds neither what goes to the reserves, the legal reserve and
  the development fund (1° and 2°), nor the work share (4°);
- a split is approved once its year is over, and once;
- the work share divides as its year's terms say: the year has adopted
  terms, the distribution names their basis, and each basis's parts add up
  to its portion of the work share, to the cent;
- a split is distributed once, after it is approved;
- a part is employed in shares only once its split is distributed;
- terms divide the whole work share, and are adopted once, never over a
  year already approved.

What it does not own:

- that the members approved a split, and moved to adopt terms:
  `motion-patronage`'s;
- that every period of the year is closed: `account-patronage`'s, since
  the periods are the account feat's;
- each worker's part on a basis: `patronage-payslip`'s by pay and in equal
  parts, `patronage-timesheet`'s by time worked, each the graft that knows
  the basis;
- that 15 % goes to the legal reserve until it reaches the highest amount
  the capital ever reached (art. 33, 1°), that the interest on capital is
  at most its terms' rate of the capital (loi n° 47-1775, art. 14), and
  the split's entry: `patronage-transaction`'s, since the reserve and the
  capital are balances of the journal;
- what of a part buys shares and what is paid: `account-membership-patronage`'s,
  and the shares credited to the associates' capital accounts and the
  return to the federation: `account-membership-patronage-transaction`'s.

## What it does not know

Patronage knows no accounts, transactions, members, motions, payslips
or time. Its approval, its parts, its posting and its credits arrive
through grafts. Paying the cash left owed in `424`, presence at the
year's end and seniority (art. 33, 3°), and a fiscal year other than the
calendar year are not built. The surplus a draft divides is typed by
finance, from the books the accountant keeps: the journal here does not
yet hold every entry it is drawn from.
Nor is the TMO: that the terms' rate is within art. 14's ceiling at each
assembly that applies them is the members' to adopt, and an assembly
whose ceiling falls under the terms' rate is not refused.

## Schema

`patronage` (`core/sql/`):

- `patronage.terms`: the statutes' terms for the work share and the
  interest on capital (`interest`, added by `005-interest.sql`),
  `stays_adopted` keeping adopted ones as they were; `terms_for(year)`
  names the terms governing a year and `basis_of(terms)` what they divide
  by.
- `patronage.distribution` and `patronage.share`: a year's surplus, the
  basis of its work share, the days it was approved and distributed, and
  its shares; `stays_approved` and `share_fixed` keep an approved split as
  it was, and let it be distributed once. `share_of(distribution, kind)`
  reads a share's cents, and `portion(distribution, basis)` the cents of
  the work share a basis divides, split by the terms' weights with
  `cella.allocate`.
- `patronage.part`: each worker's part by basis, which `part_fixed` lets
  in only in the write that approves and never changes after;
  `divided(distribution)` sets each basis's parts against its portion, and
  `patronage.statement` sums each worker's parts for a year.

Triggers raise SQLSTATE `09000`. The app role may select, insert parts,
set terms' `adopted` and a distribution's `approved` and `distributed`;
the guards role, `cella_guards`, may select.

## Personal data

A part's quantity and amount are what a worker was paid or worked and
what it earned them: personal data of class `payroll`, registered by the
worker (`003-personal.sql`), kept five years (Code du travail, art.
L3243-4) and redacted after.

## Guards

- `patronage.splits`, on `patronage:distribution:approve`: the write
  approved the split on the verdict date, its year over; the shares add up
  and honour art. 33's floors, citing the article when refused.
- `patronage.divides`, on `patronage:distribution:approve`: the year has
  adopted terms, the distribution names their basis, and each basis's
  parts add up to its portion.
- `patronage.distributes`, on `patronage:distribution:distribute`: the
  split was approved, and this write distributed it on the verdict date.
- `patronage.employs`, on `patronage:part:employ`: the split was
  distributed, and the worker the payload names has a part in it. What
  the part buys and its credit are `account-membership-patronage-transaction`'s.
- `patronage.adopts`, on `patronage:terms:adopt`: the write adopted the
  terms on the verdict date, their weights add up to 100, and no year they
  would govern is approved.

## Handlers

- `adopt` (ordered): sets the terms' `adopted` to the verdict date.
- `approve` (ordered): sets the distribution's `approved` to the verdict
  date, after which the basis grafts' triggers make its parts.
- `distributing`: the spec that marks a distribution distributed on the
  verdict date, which `patronage-transaction` wraps with its entry.
- `part.employ` has no spec here: it changes nothing of this feat's, and
  its handler is `account-membership-patronage-transaction`'s.

## Tests

`core/ts/_tests/distribution.test.ts` (`cella test slice patronage`):
Lanterne's 2025 split passes; a split under the floors, one that misses
its surplus or a percent, and a year not over are refused; a split is
approved once and never changes after; only an approved split is
distributed, once, and a part is employed only once its split is
distributed. `core/ts/_tests/terms.test.ts`: the terms governing a
year and what they divide by; each basis's portion, adding up to the
work share; parts that add up pass, one missing or a basis the terms do
not name is refused; parts are made only in the write that approves and
never change; terms that divide less than the whole, or would govern an
approved year, are refused, and adopted terms never change.
`core/ts/_tests/drafts.test.ts`: terms drafted as the request says and
whole pass, adopted ones are refused; a split drafted under adopted
terms whose shares make its surplus passes, a year with no terms,
shares that miss 100 % and an approved split are refused. The e2e
scenario `patronage` drafts terms and runs a second year, 2026, from
its periods to its distribution with no fixture SQL.

## Reads

A worker's parts of a work share, and so their statement, read for the worker and for whoever holds `distribute-surplus` (`sql/004-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)); distributions and their shares stay everyone's. `patronage.statement` reads as its reader. A write's transaction reads every part.

## Shell

The `distributions` collection, each year's surplus in a table, the
latest first, a distribution's page showing its split under a Split tab
and its state, draft, approved or distributed, and its New form drafting
a year's split; `bases`, the patronage terms by year, adopted or
drafted, and its New form drafting terms; and `statements`, each
worker's part of each year's work share, a statement's page its part
basis by basis against each basis's portion and weight. Approving and adopting are
`motion-patronage`'s forms over this feat's writes; distributing and employing follow
the approval, with no form. Printed, a page drops the shell and reads as a
document.

## Lanterne

- The statutes' patronage terms, `st-2021`, carried over, divide the work
  share by pay, employ half of each associate's part in shares, and pay
  at most 3,5 % on the capital.
- The 2025 surplus of 61 400 € is a draft distribution: m-2026-006
  approved its split in June, 27 630 € (45 %) to the members for their
  work, divided by pay, 9 210 € (15 %) to the legal reserve, which is
  under the capital, 24 111,78 € (39,27 %) to the development fund, and
  448,22 € (0,73 %) as interest on the 13 000 € of capital, 3,45 %, under
  the 455 € the terms allow. Approved citing it, ten parts make
  27 630,00 €; the distribution and the ten credits that follow it, each
  signed by Camille, buy 270 shares (13 500 €), blocked until
  1 June 2031, and leave 14 130 € owed in cash.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `patronage.distributions`, `patronage.shares`, `patronage.terms_adopted` and `patronage.parts` to the analytics shell: each distribution and its split, the terms adopted, and each distribution's parts summed by basis. A worker's part is theirs, so no row is one worker's.
