+++
title = "Analytics"
updated = 2026-10-30
+++

The analytics port (`@cella/org-analytics`): what a report asks of the
analytics shell, how the port checks it against the views the slices
publish, and the shell's implementation of it
([architecture](../../../../_corpus/doc/architecture.md#the-analytics-shell)).
A feat or a page hands the port a report and never SQL; the shell runs
it, read-only, on one snapshot of the scope, and stamps the result with
the log's head it read.

## A report

`Report` (`src/report.ts`) names:

- `from`, the views it reads, each under a name of its own, lowercase:
  `{ p: 'project.projects', m: 'project_timesheet.months' }`. The first
  is the one the others join.
- `join`, how each view after the first meets one before it: pairs of
  fields that are equal, `[['m.project', 'p.id']]`. A field is a view's
  name and a column, `p.title`.
- `fields`, what each row shows, and groups by when the report has
  measures.
- `measures`, each by a name of its own: `sum`, `avg`, `min`, `max` or
  `count` of a field, or `count` of the rows.
- `where`, filters on fields: `=`, `<>`, `<`, `<=`, `>`, `>=`, `in` a
  list, `null` and `not null`.
- `order`, by fields shown or measures, `-` before one descending, and
  `limit`, at most `MAX_ROWS` (10 000), the default.
- `personal`, every personal field the report reads, declared.

A run returns the `head` it read (the log's entry number and hash, 0 and
null before the first write), the columns with their DuckDB types, the
rows, and `more` when there were more rows than it returned. A whole
number reads as a number while it is one exactly, else as its digits; an
exact decimal, a date and a time as text.

## The check

`check(report, catalog)` (`src/check.ts`) returns every reason the
catalog refuses a report, none when it may run, and `compile` throws
`Invalid` with them. The catalog is each view the analytics role may
read and its columns, each with its type and whether its contract
comments it `personal:`. A report is refused when it:

- reads a view the catalog does not hold, such as a slice's own table,
  or a column its view does not share;
- leaves a view after the first joined to none before it, joins a view
  with itself, or joins fields of two kinds (a number, a text, a date, a
  flag), or on a document or a list, which are only shown;
- sums or averages what is not a number, or takes the least or greatest
  of a flag, a document or a list;
- compares a field with a value not of its type, with an operator that is
  none of the above, with an empty list or one past a thousand values, or
  a flag by its order; a document or a list is never compared;
- orders by what it does not show, or asks for no row or past `MAX_ROWS`;
- reads a personal field, shown, joined, filtered, grouped or measured,
  that `personal` does not declare, or declares one that is not personal.

`compile(report, catalog)` makes the checked report one SQL statement
over the shell's attach of the scope (`scope.<schema>.<view>`): every name
the catalog's, quoted, and every value a literal of its column's type,
since the shell's protocol carries no bound parameters. It fetches one
row past the limit, so the run knows there are more.

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
it.
