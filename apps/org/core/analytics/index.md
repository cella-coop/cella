+++
title = "Analytics"
updated = 2026-11-07
+++

The analytics port (`@cella/org-analytics`): what a report asks of the
analytics shell, how the port checks it against the views the slices
publish, and the shell's implementation of it
([architecture](../../../../_corpus/doc/architecture.md#the-analytics-shell)).
A feat or a page hands the port a report and never SQL; the shell runs
it, read-only, on one snapshot of the scope, and stamps the result with
the log's head it read. A report that reads a scoped view names its
reader, and reads only the rows they may; one that reads a counted view
reads only the cells open books shares with them, and those they may
read whole.

## A report

`Report` (`src/report.ts`) names:

- `from`, the views it reads, each under a name of its own, lowercase:
  `{ p: 'project.projects', m: 'project_timesheet.months' }`. The first
  is the one the others join.
- `join`, how each view after the first meets one before it: pairs of
  fields that are equal, `[['m.project', 'p.id']]`. A field is a view's
  name and a column, `p.title`.
- `outer`, the views after the first that may meet no row, joined so
  that a row of the views before them stays, their fields null: a
  project that invoiced nothing.
- `fields`, what each row shows, and groups by when the report has
  measures.
- `measures`, each by a name of its own: `sum`, `avg`, `min`, `max` or
  `count` of a field, or `count` of the rows.
- `where`, filters on fields: `=`, `<>`, `<`, `<=`, `>`, `>=`, `in` a
  list, `null` and `not null`.
- `order`, by fields shown or measures, `-` before one descending, and
  `limit`, at most `MAX_ROWS` (10 000), the default.
- `personal`, every personal field the report reads, declared.
- `reader`, where it reads a scoped or a counted view, the circles its
  reader reads it in and the reader themselves ([the reader](#the-reader)),
  and, where it reads a counted view, the circles the powers of theirs
  that read each feat's rows cover, and open books' disclosure values
  ([what is withheld](#what-is-withheld)).

A run returns the `head` it read (the log's entry number and hash, 0 and
null before the first write), the columns with their DuckDB types, the
rows, `more` when there were more rows than it returned, and `withheld`,
how many cells of the counted views it read it left out. A whole
number reads as a number while it is one exactly, else as its digits; an
exact decimal, a date and a time as text.

## The check

`check(report, catalog, saved)` (`src/check.ts`) returns every reason the
catalog refuses a report, none when it may run, and `compile` throws
`Invalid` with them. The catalog is each view the analytics role may
read, with the audience its comment declares, scoped, shared or the
contributions to a shared view, which make that view counted (one that
declares none is none of it), and its
columns, each with its type and whether its contract
comments it `personal:`. A report is refused when it:

- reads a view the catalog does not hold, such as a slice's own table,
  or a column its view does not share;
- leaves a view after the first joined to none before it, names in
  `outer` one that is not after the first, joins a view with itself, or joins fields of two kinds (a number, a text, a date, a
  flag), or on a document or a list, which are only shown;
- sums or averages what is not a number, or takes the least or greatest
  of a flag, a document or a list;
- compares a field with a value not of its type, with an operator that is
  none of the above, with an empty list or one past a thousand values, or
  a flag by its order; a document or a list is never compared;
- orders by what it does not show, or asks for no row or past `MAX_ROWS`;
- reads a personal field, shown, joined, filtered, grouped or measured,
  that `personal` does not declare, or declares one that is not personal;
- reads a scoped or a counted view, or joins one, with no `reader`, or
  a counted view with a reader that gives no circles by feat or no
  disclosure values, none where no rule stands; reads a contributions
  view, which only the port reads; or filters a shared view by a field
  below the grain it declares, any but those it is shared by. A saved definition, which whoever runs it reads, is
  checked with `saved` and names no reader.

`compile(report, catalog)` makes the checked report one SQL statement
over the shell's attach of the scope (`scope.<schema>.<view>`): every name
the catalog's, quoted, and every value a literal of its column's type,
since the shell's protocol carries no bound parameters. It fetches one
row past the limit, so the run knows there are more.

## The reader

A report that reads a scoped view reads it for one reader
([audiences](../../../../_corpus/doc/architecture.md#analytical-contracts)).
The org app's server asks Postgres, as that reader, which circles their
mandates cover for each scoped view's slice, by the test its row-level
policies take (`circle.reads`), and hands the port the circles and the
reader: `scoped(port, db)` (`src/reader.ts`) is the port as the reader
of the request's connection reads it, each run asking first, and the
server hands every page and pin that one. `compile` filters each scoped
view to the rows whose circle column is one of those circles, or, where
the view names whose a row is, whose person is the reader, in the join
that meets it, so a view joined `outer` keeps the rows before it, and
the report reads what the app shows them and no more; a reader whose
mandates cover nothing reads no row. A
report with no `reader` that reads a scoped view is refused before the
shell sees it, so no page and no feat runs one without a reader. A
shared view is read whole by every reader, but for the cells of a
counted one ([below](#what-is-withheld)).

The same question, asked once, names for each feat the circles that
powers of the reader's over its rows cover, `cella.circles(feat)`
(`opens`), and open books' disclosure values in force on the verdict
date, `circle.disclosed`, or none where no rule stands or the reader
reads none, as a person who is no member reads none of the structure
([circle](../circle/index.md#who-reads-the-structure)), so they read
only their own cells of a counted view (`disclosure`).

## What is withheld

A counted view is a shared total of members' own figures, whose
contributions its contract publishes
([analytical contracts](../../../../_corpus/doc/architecture.md#analytical-contracts)).
`compile` reads it as only the cells its reader may read: in place of
the view, the rows of it whose cell is

- the reader's own: every contribution to it is theirs, or is in a
  circle `opens` names for the feat its contributions are read by, so
  a reader sees what their own permission opens, unwithheld; or
- shared by open books: at least `disclosure_contributors` people put
  into it, its largest contribution is no more than `disclosure_largest`
  of the whole, the two largest no more than `disclosure_two`, and the
  whole is more than nothing, each contribution counted by its size.

A cell with no contribution, a project no one has logged time on, is
no one's figure and reads. Where no disclosure rule stands, only the
reader's own cells read. Every other cell is left out before the report
joins, filters or sums, so each total a report shows is the sum of the
cells it may show: a margin is never the whole less a withheld cell,
and no two reports differ by one. Each run counts the cells of each
counted view it read that it left out, `withheld`, so a page can say a
figure is missing; the contributions themselves, each person's part,
never leave the shell.

What it does not stop: one shared view differenced against another over
the same people, as `timesheet.months` against
`project_timesheet.months`, or a cell's value before and after a member
joins or a correction lands, or what a reader knows from outside the
books. `read` alone opens no contribution here, as it opens no one's
pay, so a member who reads a circle's expenses by open books reads a
withheld cell of `expense_project.totals` withheld.

## The shell's implementation

`shell(options)` (`./api`, the server half) is the port over a running
shell: a DuckDB client that loads `httpfs` and `quack`, attaches the
shell's server by its address and token, and runs each call on a
connection of its own, routed to the server (`CONNECT`) in one
transaction. The shell's attach reads the scope on one Postgres
transaction, repeatable read and read-only, for the whole of it, so a run
reads the head, the catalog and the report on one snapshot, and a write
that lands meanwhile moves none of them. `catalog()` reads the catalog
alone. `fromEnv()` reads the shell as `cella` hands it to a server:
`CELLA_ANALYTICS`, its address, `CELLA_ANALYTICS_TOKEN_FILE` and
`CELLA_DUCKDB_EXTENSIONS`.

## The head

The port's own SQL (`sql/`) makes the schema `analytics` and publishes in
it the one view no slice can, `analytics.head`: the log's head, its
entry's number and its hash in hex, which a run reads first and is
stamped with. It is the analytics role's only reach into the notary: the
log itself it never reads. No report reads the head as a view.

## Tests

The e2e scenario `analytics-shell` starts a shell on the test database
with `cella analytics start`, then checks that it reads only as
`cella_analytics`, refusing a write, a file, another attach, a setting and
an unpublished table; that the catalog is the views granted to the role;
that a report reconciles with the books to the cent and with the
projects' time, and is stamped with the head; that a write landing in a
run's transaction moves neither its rows nor its head; and that the port
refuses each kind of report above with its reason, before the shell sees
it, and reads a scoped view for its reader alone: the rows of the
circles they read it in and their own, and none where they read in no
circle; and withholds a counted view's cells below open books' values
from a reader outside them, reads them to a reader whose powers read
their rows, and leaves no withheld cell between a total and the same
total less a cell. The e2e scenario `reading` runs a saved custom report over a scoped
view as Lanterne's readers: Inès, in Web and no member, reads Web's and
the assembly's rows and no other circle's, and a person whose mandate
to read went reads none of them. The e2e scenario `report-reader` runs
one through the built shell across a mandate's end: Chloé, a member,
saves a custom report over `expense.expenses` while the member role's
mandate to read every circle stands, and reads every expense through
it; the assembly ends the mandate; the same report, and a new one she
saves, then show her Marketing's and the assembly's expenses and her
own, one she spent for Brand among them, and no other of Brand's or
Web's, as the expenses' page does, through the page and through the
port run as her; and Inès, who never held the mandate, reads Web's and
the assembly's alone through both.
