+++
title = "Import"
updated = 2026-11-04
+++

What a co-op brings in from the tools it leaves, the five to eight a small
co-op runs before cella ([users](../../../../_corpus/doc/users.md)): each
import of a file, what each of its lines came to, and the Imports page.

## How an import runs

A slice reads each kind of file whose records are its own writes (`imports`
in its server side, an `Importer` in `@cella/org-db`), so the feat that
owns a write is the one that knows its fields:

| Kind | Read by | Each record | Formats |
|---|---|---|---|
| `members` | `membership` | an invitation, to be given its link from the member's page | CSV: address, name |
| `clients` | `client` | a client added | CSV: name, kind, form, email, phone, tags, note |
| `fec` | `account-transaction` | an entry carried over, opening the accounts it names | the FEC (Livre des procédures fiscales, art. A47 A-1) |
| `invoices` | `invoice-transaction` | an invoice issued and posted | CSV: a row per line |
| `toggl` | `employment-project-timesheet` | a worker's own time booked to a project, or the co-op's | Toggl Track's detailed report |
| `harvest` | `employment-project-timesheet` | as Toggl's | Harvest's detailed time report |
| `projects` | `project` | a project created | CSV: title, circle, summary, due |
| `tasks` | `project-task` | a task, in the project it names | CSV, or Asana's task export |

The root runs an import across them (`apps/org/ts/src/lib/server/import.ts`):
it reads the file as the kind's slice says, makes each record's write as
the importing member, in the file's order, signed and judged by the guards
like any write, and records the run here. A line the slice cannot read is
refused before any write. A **dry run** makes each write and rolls it back,
so it says what would be created and what refused; since the notary takes
one receipt for a transaction, each write runs in its own, and a line is
judged on the co-op as it stands, not on the lines before it.

Nothing comes in around the guards: a member comes in invited, their first
device made when they take up the invitation, a worker's time is their
own, an entry balances and falls in an open period.
So each worker imports their own time export, and a FEC's opening balances
are an à-nouveaux entry dated in the first open month.

## After the founding

A co-op is founded once, by the log's first entry, the founding
([membership-motion](../../grafts/membership-motion/index.md#founding)),
which `cella seed` makes for a mock co-op from its fixture, carrying the
state it held before its log with it. Every import comes after it: a
co-op leaving its tools brings its books in after its founding, never in
it, each import below a write under the importer's mandates, as a FEC's
entries are carried over by the power `carry-books`.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| run | `id`, `kind`, `name`, `actor`, `day`, `dry`, `settled`, `refused`, `lines` | `id` is `im-0001` and up; `lines` each a line's number, what it is, the action, its outcome, its entry or reason |

What a line is names a record by its id, its address or its title, never
a person's name: a person among the clients is `a person, line 4`.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/import/record` | confluent, `record-import` | the record of an import is a fact, the importer's own; every person's right |

## Guards

- `import.records`, on `import:run:record`: the run is the actor's on the
  verdict date, with the kind, the dry run and the counts the write names.
- The table checks that the counts add up to the lines.

## Schema

`import` (`core/sql/`): `import.run`, numbered from `import.number`. The
app role may select and insert; the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Tests

`core/ts/_tests/run.test.ts` (`cella test slice import`): a run recorded
as its importer on the day, its lines counted; the counts must add up, and
the guard refuses a run the write does not name. The e2e scenario `import`
runs every kind on Lanterne's samples.

## Shell

The `imports` collection in Platform: each import with its kind, whether
a dry run, and how many lines settled and were refused; New, a file of a
kind tried in a dry run or imported; an import's page, each line with its
write, its outcome and its entry or reason. `cella import <kind> <file>
--as <address> [--dry-run]` runs the same from the command line
([the CLI](../../rs/index.md)).

## Lanterne

None yet; [its samples](../../fixtures/lanterne/import/index.md) hold a
file of each kind.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `import.runs` to the analytics shell: each run, its kind and day, and how many of its records settled and were refused.
