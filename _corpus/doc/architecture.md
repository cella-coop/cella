+++
title = "Architecture"
updated = 2026-11-02
+++

# Architecture

Cella is built as a tree of **feats**. The root feats of the repository are
its **apps**; apps hold feats, feats hold feats, and **grafts** join feats.
Each feat's **core** holds the libraries its feats inherit. The rules are
corpus's composable architecture as ruled on 2026-10-17, with seedling's
layers inside each package and the write labels and feat rulings of
2026-10-24.

## The tree

```mermaid
flowchart BT
  core["apps/org/core: actions, crypto, log, keystore, …"]
  person["feats/person/core"]
  membership["feats/person/feats/membership/core"]
  motion["feats/motion/core"]
  circle["feats/circle/core"]
  graft["grafts/membership-motion"]
  three["grafts/circle-membership-motion"]
  root["apps/org/ts: the shell"]
  person --> core
  membership --> person
  motion --> core
  circle --> core
  graft --> membership
  graft --> motion
  three --> graft
  three --> circle
  root --> three
  root --> graft
  root --> membership
  root --> motion
```

A node is a directory with a `feat.toml`. It holds:

- `core/` — what the feat is, and the libraries its children and grafts
  build on, one package each (`core/<lib>/rs`, `core/<lib>/ts`). The app's
  core is its shared library layer: `actions` (labels, permissions,
  outcomes), `crypto`, `log`, `keystore`, `guards` (the pure guard primitives), `notary`
  (the `cella` Postgres extension over them), `db` (an action's transaction),
  `sign` (a device's signature on an action), `vat` (a document's lines,
  their amounts and VAT, which invoices and bills share), `analytics`
  (the port reports are read through), `policy` (the register of the
  policies circles adopt by motion, [policies](#policies)), `ui` (the shell's tokens and
  components) and later `auth`. A leaf feat's core is all of it.
- `feats/` — its child feats, the same shape.
- `grafts/` — the joins between the feats below it, at any depth, that no
  child of it holds all of ([grafts](#grafts)).
- `rs/`, `ts/` — the node's root, which assembles it. Only a node that links
  its feats into a binary or a shell has one. Org's `rs/` root is `cella`,
  the CLI that is the repository's one entry point for every development and
  production task ([the CLI](../../apps/org/rs/index.md)); its `ts/` root is
  the shell.

Every package is an ordinary package in its ecosystem: a crate in `rs/`, an
npm package in `ts/`, one to a directory. The workspaces find them by glob
(`apps/**/ts`, `apps/**/rs`), so cargo, pnpm and editors work unchanged.

## Feats

A feat is a collection of things and is named for the collection it holds:
`person`, `motion`, `invoice`. `account` holds the chart of accounts,
members' capital accounts, reserves and funds, and their periods and
balances; `transaction` holds the journal's entries, a collection in its own
right. A federation-facing name more specific than these may come later.

What is a top-level feat is decided case by case, and most of org's feats
are top-level: they sit flat under `apps/org/feats/`. A feat nests under
another only when it is a genuine sub-feature of that one feat, and
`person` is the one that holds feats today: `membership` and
`employment`, under `feats/person/feats/`. A person is who someone is,
their name, their contact details and their devices; a membership and an
employment are what they may hold, each with its own days. Nested, the
children inherit the parent's core, so each reads the person and neither
knows the other, and a person's roles are derived: a member is a person
who holds a membership, a worker one who holds an employment. A contact
and an agent are later children of the same shape. What everything grafts
onto belongs in the parent's core, not in a feat.

A feat's name is unique in its app, at any depth, since it names its
schema and the grafts that join it; `cella check feats` refuses a second
one.

The notary is not a feat but a layer under every feat: the `cella`
Postgres extension, a package of org's core (`apps/org/core/notary/rs`),
which every feat's SQL calls and every write passes through. It holds no
collection and has no writes of its own. Moving a scope's notary is moving
its database to another host, which arrives at rung 6
([ratchet](ratchet.md)).

## What may depend on what

| A package in | may depend on |
|---|---|
| a feat's core | the other packages of its own core; its ancestors' cores, a nested feat's parent's among them |
| a graft | the cores of the feats it joins and of their ancestors, its node's among them; the grafts at or below its node that join a proper subset of its feats ([graft order](#graft-order)) |
| a node's root | its own and its ancestors' cores, the cores and roots of the feats below it, the grafts at or below it |

Nothing is ambient: no global module, no library outside the tree, no
re-export that reaches around it. Third-party crates and npm packages are
the only dependencies from outside. When two apps need the same library, the
repository's root becomes the top node and the library moves into its core.

Architecture rules are enforced by tooling wherever a tool can see them.
`tools/feat-check.mjs` (`cella check feats`) reads each `package.json` and
`cargo metadata`, the manifests cargo and pnpm read, and not the lockfile.
It places each package by its path and refuses any other edge. It also
checks that every graft is declared by a feat it joins, that its name is
in order, that every feat it names is below its node and that no child of
its node holds them all, that it joins no feat with one nested in it, that
a feat's name is unique in its app, that a package's relative imports stay
inside it, and that a feat's or graft's actions are named for it and
declared in its `models/actions.ts` alone. Through
`tools/sql-check.mjs` it checks every `sql/` file (see [SQL](#sql)), and
through `tools/powers.mjs` that the power each action's label names in
`actions.ts` is the one its SQL registers in `cella.power`, and that an
action with no power declares a check its SQL backs
([actions](#actions)), and
through `tools/writes.mjs` that no feat or graft writes a table it does
not own beyond the app's listed exceptions ([writes stay
home](#writes-stay-home)).
`cella test tools` holds their negative tests.

## Grafts

A graft owns a relationship between feats: its model, its junction table
with keys into each, and the handlers that react on either side. It is
named by the feats it joins, hyphenated in alphabetical order
(`membership-motion`), so a feat's name has no hyphen. Most grafts join two
feats; a graft may join more where the relationship needs it, but avoid it
where two-way grafts will do. The feat that extends the others declares it
in its `feat.toml`. A graft has no pages of its own.

A graft sits at the lowest node that holds every feat it joins: under that
node's `grafts/`, where no child of the node holds them all. A graft
joining two of org's feats sits in `apps/org/grafts/`, and so does one
joining a nested feat to another of org's, as `membership-motion` joins
`motion` and `person`'s `membership`; one joining two children of
`person` sits in `feats/person/grafts/`, as `employment-membership`, a
worker's candidacy for membership, does. A graft names the feats it joins
whatever their depth, and never a feat with one nested in it: a child
already reads its parent, so `membership-person` would join nothing. A
graft that joins a nested feat reads its parent's core too, as the feat
does: `membership-motion` reads the member's name from `person`.

No foreign key crosses a feat boundary. A feat handles an unlinked entity
gracefully: an invoice without a client is unbilled, not invalid. The graft
adds the link.

A graft may also own actions on the relationship it holds, such as who
holds a seat: its permission is `<graft>:<entity>:<verb>`, served as
`POST /api/<graft>/<verb>`, the same pattern as a feat's.

### Graft order

A graft's order is the number of feats it joins. A graft that joins N
feats may read, in code and in SQL, the feats it joins, the cores below
them, and the grafts at or below its node that join a proper subset of its
feats, as `employment-membership-motion` reads `person`'s
`employment-membership`:
`circle-membership-motion` reads `circle-membership` and `membership-motion`.
Nothing else: no graft of equal or higher order, and no graft that joins a
feat it does not. Relationships compose upward, so a higher graft builds on
lower ones and no lower graft ever depends on one above it. Migrations run
a node's grafts lowest order first, after every node below it, so a lower
graft at a nested node is in before the graft above that reads it.

A relationship that needs another graft's data therefore lives in the
graft that joins all the feats involved. A motion's roll needs seats
(circle and member) and the motion, so it is `circle-membership-motion`'s,
and so is everything that counts the roll. A lower graft that needs what a
higher one decides declares it through a feat they share: a graft that
cites a motion lists its action in `motion.cites`, and the graft that
counts the roll attaches its guard to every action listed, so neither reads the
other.

### Writes stay home

A feat's rows change only through its own code: its handlers, and its
SQL on its own tables. A graft reads the feats it joins and its
lower-order grafts, and writes only its own schema. It changes a feat
only by calling that feat's published write from its handler, inside
the one `write`, as `invoice-transaction` calls `record()` from
`@cella/org-transaction/api`. It reacts to a feat's settled write
through its server slice's `on`, and it refuses a feat's action by a guard
on it in `cella.guard`, which the notary runs. It never uses a
trigger on the feat's table for either. What a graft would only copy
from a feat's row it reads by a view in its own schema, as
`document_motion.adoption` reads what each action to adopt names. A nested feat changes its
parent's rows the same way, through the parent's write. No SQL of a
feat or a graft inserts, updates, deletes, merges or truncates a table
outside its own schema, or makes a trigger on one; it writes `cella.*`
only to register ([SQL](#sql)).

What follows a passed motion is its carried actions, never a trigger.
Each is its owner's published action, a write of its own after the
close, signed by whoever closed the motion, citing it, and judged by its
own guards: `circle-membership-motion` carries out a suspension or an
exit through the membership feat's, and the graft that knows what
follows an admission or an exit reacts to it through `on`.
`account-membership` freezes a departed member's capital accounts
through the account feat's `freeze`; `account-membership-transaction`
subscribes a member admitted, their account opened by the account
feat's `holding` and their shares called through `record()`, and
withdraws a departed associate's capital. A distribution approved citing
the assembly's motion is followed the same way: `patronage-transaction`
posts it through `distribute`, and
`account-membership-patronage-transaction` credits each associate the
shares their part buys through `employ`, posted through `record()` and
added to what they hold by the membership feat's `crediting`, each
signed by whoever signed the approval and citing its motion. The shell
runs the reactions to each write a reaction makes, so a close carries an
exit and the exit its freeze and withdrawal, and an approval its posting
and the posting its credits, each settled before the next. A write is one
transaction with one verdict, so a carried action refused leaves the
close and every action before it settled, and says why
([trust](trust.md#three-kinds-of-action)).

A feat that keeps a register its extenders fill owns it the same way.
The extenders register through a function the feat publishes, and that
function, the feat's own code, writes the row: a graft's migration calls
it and never inserts the row itself. `membership-motion` registers
`admit`, an action a motion can carry, with the action that carries it
out, by `motion.register_carries`, and its admission's action, which
cites the motion that passed, with the power its collective mandate
grants, by `motion.register_cite`. The register is how the feat finds
what its extenders bring, and it knows none of them by name. A guard
that covers every action listed is registered by
`motion.register_cite_guard`, which attaches it to every action listed
so far, and `motion.register_cite` attaches each guard so registered to
the action it lists, whichever migrated first, so no graft puts a
trigger on the register: `circle-membership-motion`'s, that the motion
passed on its roll, and `circle-motion`'s, that the motion's circle
holds a collective mandate for the action's power. `cella check feats`
reads each call's literal action and power as it reads a literal row.

`cella check feats` checks this. `tools/sql-check.mjs` collects every
such write and trigger that the owner's migrations leave standing. A
later file that drops the trigger, or drops or replaces the function,
takes it away, and a slice may drop its own trigger on another's table.
`tools/writes.mjs` scans each feat's and graft's TypeScript, its tests
aside, for SQL that writes a table outside its schema. Both are held to
the app's `foreign.list`, which lists the exceptions that predate
the rule (2026-10-29). The check refuses an exception the list does not
name, and also a listed line whose write is gone, so the list only
shrinks. Each exception moves to its owner by its migration, rewritten
in place, a handler and its feat's published write. A write no tool can see, such as
SQL built at run time (`EXECUTE`, or a string assembled in TypeScript),
is left to review.

## Guards

A guard lives at the lowest level that owns it: in a feat if it concerns
only that feat's collection, in a graft if it concerns a relationship, and
in a node's core only if it spans everything below that node.

- A payment beyond an invoice's total leaves a credit owed to the client,
  rather than being refused: the invoice feat's guard, since the payments
  are part of its collection.
- Nothing posts into a closed period: the `account-transaction` graft's.
  The period is an account's and the entry a transaction's; neither feat
  sees both, and the graft that resolves an entry's lines to accounts does.
- A surplus split adds up to the surplus: the patronage feat's. That the
  members approved it is the `motion-patronage` graft's, and that the
  year's books are closed `account-patronage`'s.

A guard is SQL in its owner's schema (see [SQL](#sql)). The notary runs
every guard that attaches to an ordered write, those of the feat and of the
grafts it touches; it holds no guards of its own beyond the primitives. How
guards are composed and adopted is in [trust](trust.md#guards).

## SQL

Each feat and each graft owns a Postgres schema and the SQL in it: tables,
row-level policies, triggers and composed guards, which are plain
`LANGUAGE sql` functions over the `cella.*` primitives. The SQL sits in a
`sql/` directory beside the core package: `feats/<feat>/core/sql/`,
`grafts/<graft>/sql/`. A schema takes its owner's name; a graft's hyphens
become underscores, so `client-invoice` owns the schema `client_invoice`.

A co-op's customisations are custom feats: a feat of its own, with its own
schema, SQL and grafts, built on the same primitives and enabled by
motion. Custom feats are how cella is extended.

| SQL in | may reference |
|---|---|
| a node's core | `cella.*`; the notary's `vault.*`; the catalog; a core library's own schema, named for it (`analytics`, `policy`) |
| a feat's schema | its own schema; the schemas of the feats it nests in; `cella.*`; the policy register but its wording; the catalog |
| a graft's schema | its own schema; the schemas of the feats it joins and of the feats they nest in; the schemas of its lower-order grafts, at or below its node; `cella.*`; the policy register but its wording; the catalog |

A graft's schema holds the junction, with keys into each feat's tables; no
foreign key crosses a feat. `feat-check` enforces these boundaries by
parsing every `sql/` file with libpg_query, Postgres's own parser,
PL/pgSQL bodies statement by statement. Beyond references, it refuses SQL
that creates, alters, indexes, drops or grants outside its own schema;
holds a foreign key out of it; reads a policy's wording
(`policy.wording`, [policies](#policies)); writes `cella.*` other than to register,
under its own name, its guards on its own actions, those of the feats it
joins and those of the lower-order grafts it builds on, the power each of
its own actions needs as a literal row, the powers that read the rows of its
own feat or of the feats it joins (`cella.reading`), a feat only the
keyring, or a graft only the authority that says who holds a power
(`cella.authority`) and what opens a joined feat's rows to more readers
(`cella.reach`), each a literal row; sets
`search_path` other than a function's to the catalog; reads the clock or
randomness; or hides statements in a `DO` block. A row-level policy is
created, and a function altered, only in the owner's own schema. It
also refuses a write or a trigger on a table outside the owner's schema
and `cella.*`, beyond the exceptions the app's `foreign.list` still
names ([writes stay home](#writes-stay-home)). A slice may drop a
trigger of its own on another's table.

A table holding a person's pay, time, capital, personal files or a
capital account's lines keeps row-level security for the app role: the
person reads their own rows; whoever holds a power its feat names in
`cella.reading` reads them all; a graft that knows more opens a row
further through `cella.reach`; a write's transaction and the guards role
read the whole. The pattern every row-level policy takes, the power checks asked
once per query:
`USING ((SELECT cella.sees('<feat>')) OR member = cella.reader() OR
cella.reaches('<feat>', member))`. A view over such a table reads as its
reader (`security_invoker`), unless what it shows is a sum every member
reads, as the statements' rubrics and a project's burn are, or a share
that needs the whole to divide, which filters its rows by the same test
instead. A stance on a secret ballot is the one row no power opens: its
row-level policy reads `cella.writing()` in place of `sees` and asks no `reaches`,
and a motion's tally sums it as its owner, sealed until the close.

SQL is the source of truth for guards. TypeScript calls them and never
re-implements one; the browser may preview a guard through the primitives
compiled to WASM.

### Migrations

Migrations cascade down the feat tree: a node's core first, then its feats,
then its grafts, recursively, each versioned. They are plain SQL, and the
TypeScript types are generated from the schema; seedling's Drizzle, where
TypeScript owns the schema, is dropped. The generator is not chosen.

`tools/migrate.mjs` (`cella migrate`) walks the tree in that order and applies
each `sql/` directory's `NNN-*.sql` files, one transaction each, recording
every file by its id and its hash in `migration.applied`. A migration
changes the schema and its registries, a superuser's act and no write,
so it runs with `cella.unbound` set and the notary's trigger lets its
rows through; every table it makes is registered as a state table as it
is made. A migration's id is stable: its app, the feat or graft whose
SQL it is, and its file name, `org:membership/003-seats.sql`, or
`org:core/notary/001-cella.sql` for a core, so a feat that moves in the
tree keeps its ids. Renaming a feat changes its ids and `cella migrate`
maps no old id to a new one, so a rename rebuilds every database, and
from launch a feat a scope has applied is not renamed.

Until launch, migrations are the prototype's to rewrite. No scope is
live, so a change edits the file that makes what it changes, and every
database is rebuilt: `cella migrate` refuses a database that applied a
file since edited, or one the tree no longer has, before it runs any,
saying to reset it, and `cella db reset` drops it, migrates it anew and
seeds it from its fixture. There is no `migrations.lock` until then.

At launch the migrations are squashed into one initial migration for
each core, feat and graft, `001-<name>.sql`, and from then on they are
append-only. Each app's `migrations.lock` keeps every migration's id and
hash: `cella check` fails on a locked file edited or gone and on a file
not locked, and `cella migrate --lock` locks the new ones. A change is a
new file. The notary changes the same way: its upgrade script ships with the
extension, and a migration appended to `core/notary/sql/` runs `ALTER
EXTENSION cella UPDATE` ([the notary](../../apps/org/core/notary/index.md#build)).

### Analytical contracts

Analytics read the scope apart from everything else: the analytics shell
reads the slices' analytical views through a read-only role, and joins
across slices there and only there. A guard that decides a write stays in
its slice, through the notary; an analytical view only describes.

Each slice that has something to share publishes it in its **analytical
contract**, `sql/analytics.sql` beside its migrations: views in its own
schema, each with the columns it agrees to share, and comments on them.
A view reads what the slice's other SQL may read ([above](#sql)), its
amounts in cents (`cella.cents`), and its columns are plain types any
client reads. A slice that holds only guards or registries publishes
none; a feat's contract shares its collection, and a graft's what it
joins, such as `account_transaction.movements`, the journal by account
and day, which every statement sums. No core publishes one but the
analytics port's, `analytics.head`, the log's head each run of the shell
is stamped with ([the analytics shell](#the-analytics-shell)).


A contract is no migration: `cella migrate` applies every contract after
the migrations, whenever one ran or a contract changed. It drops the
views published before, so a migration never meets one, applies each
contract whole in tree order, grants `cella_analytics` SELECT on each
view the contract made and USAGE on its schema, then reads every view as
that role and fails the run on a view it cannot read or a column of a
type that is not plain. The role is granted nothing else
([trust](trust.md#the-analytics-role)).

A view reads as its owner, so the role needs no grant on a table, and a
view shares what its slice agrees to share and no more:

- a column registered in `cella.personal` only where the view's column is
  commented `personal: why`, or `not personal: why` where its rows hold
  none, as `account.chart` shows only the accounts no one holds. Erasure
  redacts the column in its table, so the view shows it redacted;
- from a table under row-level security, or a view over one, only sums
  over its rows, grouped by no column that says whose a row is (one its
  row-level policy compares with `cella.reader()` or opens by
  `cella.reaches()`) unless that column is shown and declared; or the
  rows its row-level policy opens to everyone, kept by the view's own
  `col IS NULL`. So the payroll is
  shared as each month's sums, and a capital account's lines are summed
  into its parent's code.

`cella check feats` enforces this: `tools/sql-check.mjs` refuses in a
contract anything but views in the slice's own schema and comments on
them, a `security_invoker` view, an undeclared personal column, a
secured table's rows, a sum by whose a row is undeclared, a contract in
a core but the port's, and any grant to `cella_analytics` anywhere in the
tree. What a column is carries
through a slice's own views. A function a view calls runs as the role,
not as the view's owner, so one that reads a table fails the role and
one that asks who reads sees no one: a contract reads tables and plain
views, never a `security_invoker` view or a function over them, and
`cella migrate`'s read as the role, and the e2e scenario on Lanterne,
catch what the SQL check cannot see.

### Tests

SQL logic is tested in the database. pgTAP tests and Lanterne's
conformance suite, its cases and their expected verdicts, are gates
alongside `cella check`; neither is wired in yet. A slice is a feat or a
graft, and node tests come in two kinds, placed by where they sit; a test
file anywhere else fails `cella test`:

- a **slice test** tests exactly one slice, from its package's `_tests/`.
  `cella test slice [NAME]` runs each slice's tests on a database migrated
  with the app's core and that slice's part of the tree alone (a feat's
  own tree; a graft's feats, its lower-order grafts and itself), unseeded,
  so a slice test cannot lean on a slice it does not own, and a package
  imports only what its manifest names. Its database is unbound
  (`cella.unbound`), since a slice test writes the rows it needs below
  the notary. A slice that publishes an analytical contract is migrated
  so even with no test file, which applies its contract on its part alone
  and reads each view as `cella_analytics`.
- an **e2e test** is a scenario across slices, from an app root's `_e2e/`.
  `cella test e2e [NAME]` runs each on a database migrated whole and
  seeded with Lanterne, through the handlers.

Both run on the dev cluster (`cella db start`), on `cella_test`, renewed
for each slice and each scenario.

## Inside a package

Seedling's layers, innermost first; imports point inward only.

- Server: `models` (types, schemas, invariants, `permissions`, `actions.ts`) →
  `interfaces` (repository contracts) → `handlers` (`(input, deps) → Result`,
  jobs) → `drivers` (repositories over the feat's schema) → `api` (remotes,
  endpoints, events, subscriptions).
- Client: `hooks` → `components` → `bindings` (sockets, plugs) → `app`
  (pages, views, panes, blocks).
- Tests in `_tests/` beside `src/`, a feat's or graft's slice tests; an app
  root's e2e tests in `_e2e/`.

A package's `exports` name its public surface: a core library's `.`, and a
slice's `./models`, `./api` (its writes, its reads and its server slice),
`./bindings` and `./app` (its client slice). Nothing else is importable
from outside it, and `cella check feats` refuses any other export.

### Client state

The client layers follow seedling's hooks: a component holds no state of
its own beyond its props and what it derives from them. State lives in a
**state class**, `hooks/<Name>State.svelte.ts`, with `$state` fields,
`$derived` fields and methods for its actions, and is reached through one
hook, `hooks/use<Name>.ts`: `useName(…)` returns the instance in context
(`createContext`'s `has` and `get`), or creates it, sets it and returns
it. The first component to call it creates it; its descendants share it.
A state class starts from the page's data, handed in as getters, so the
server and the browser render the same state and it follows the page
when a write refreshes it; nothing loads data from a component. Writes go
through form actions. No client module keeps mutable state at module
level, which the server would share between requests.

`cella check feats` enforces what it can see (`tools/ui-check.mjs`): only
the UI core holds CSS, no other `.svelte` file has a `<style>` or a
`style` attribute; `$state` appears only in a state class under `hooks/`;
no client module, nor a component's `<script module>`, declares a
top-level `let` or `var`; no `.svelte` file or module under `app/`,
`hooks/` or `components/` imports a server layer: a package's `api`,
`drivers`, `handlers` or `interfaces`, `@cella/*-db` or `pg`; `$effect`
appears only in a state class, so a component derives, attaches
(`{@attach}`) or handles an event instead; and no source uses a legacy
Svelte or SvelteKit form: `on:event`, `<slot>`, `use:`, `{@const}`,
`$$props`, `export let`, `$:`, `createEventDispatcher`, string-keyed
`setContext`/`getContext`, `$app/stores`, `$lib`, `$env` or
`invalidateAll`, nor `{@html}`.

## The shell

The org app's `ts/` root is the shell, a SvelteKit 3 app that mounts every
slice; it holds the routes and no feature of its own. Each slice exports
two halves of one **slice**, matched by name:

- from `./api`, its server side (`Slice` in `@cella/org-db`): the
  collections it owns, each with its reads (`list`, a SQL select of its
  rows as the acting member sees them, `item`, given the page's address
  as a report is given its span, `index` for the command
  menu, `about` for the collection's header) and its writes as form
  actions, each a handler over a form; what it adds to the collections
  of the feats it joins and of the feats they nest in, and a nested feat
  to its parent's (`extends`, with `within` naming the parent): fields
  on each row (`list`, a select of each row's id and its fields), rows
  of its own in a collection that gathers them from the slices that know
  each kind (`rows`, a select too), as the person feat's inbox gathers
  what waits on a person, data on an item, what it adds to the collection's `about`, such as the
  circles a new motion may be put in, writes, and whether it opens an
  item's bytes its owner keeps closed (`allows`), as a power over
  expenses opens a receipt; and reactions to
  other slices' settled writes (`on`), such as carrying out what a
  passed motion carries once its close settles; and the kinds of file
  it imports from other tools (`imports`), each record read as one of its
  own writes, which the root runs as the importing member and records in
  the import feat.
- from `./app`, its client side (`App` in `@cella/org-ui`): for each
  collection it owns, a view (its columns, its New form, the status
  badge its header shows and its dashboard's widgets) and a page (its title, its Properties, Related and Activity cards, its
  blocks and its header writes); for each collection it extends, columns
  over the fields it adds, cards and blocks over its data on an item,
  and a New form for a write of its own, replacing the owner's, or, where
  several slices offer one, beside the others under its title, as the
  people collection takes membership's invitation and employment's hire.

The root lists the slices, server and client, and mounts them on
routes that are the same for every collection: `/[collection]`, the one collection
component, and `/[collection]/[id]`, the one detail view, each with the
form actions of the collection's slices; `/search` for the command menu;
`/[collection]/[id]/[stream]`, an item's live stream as server-sent
events, which the collection's owner names (`streams`, such as a
document's edits as they settle); `/[collection]/[id]/content`, an item's
bytes, such as a file's, which the collection's owner serves (`content`)
to whom its guard or an extension's `allows` opens them; `/sign-in`,
`/session`, the challenge and the device's answer to it, and
`/sign-out`; `/join/[secret]`, an invitation's link, taken up through
membership's `accept`; `/theme` for the user menu; `/journal`, the transactions' old address,
which redirects to them; and `/`, the co-op's home, a dashboard of widgets pinned from many
collections and from reports. A collection's owner is a feat,
or the log, a core library. A graft extends only a collection of a feat it
joins, or of a feat one of them nests in, and a nested feat its parent's,
as membership and employment extend person's people; the root may join
two feats no graft joins, as it puts on the
work collections' cards fields from several grafts, pins the home's
widgets until a viewer pins their own, and runs an import across the
slices that read its kind. A form posts its files with its fields, and an
action reads them whole (`Form.file`). The registry refuses a
collection owned twice, an extension of a feat a slice neither joins nor
nests in, and two extensions replacing one write. An extension's write replaces the
owner's of the same name: `invoice-transaction`'s issue, which posts the
invoice in the same transaction, replaces the invoice feat's.

The shell writes no SQL and re-implements no guard: it reads through each
slice's reads and writes through its handlers, which sign, submit and
return Settled, Refused or Pending. Its pages show each outcome, with
the guard's reason when refused. Every route but the sign-in, its session
and an invitation's link needs a session, a person signed in on one of
their current devices (`hooks.server.ts`, `lib/server/session.ts`): a
page asked for without one goes to the sign-in, and anything else is
refused. Every read is the session's person's: each connection the shell
takes (`using(actor, …)` in `lib/server/db.ts`) sets `cella.actor` from the
session before any query and clears it after, so the database's
row-level policies, not the shell, decide what a page shows
([trust](trust.md#one-server)). A write is signed in the browser by the session's device: the
action runs as a relay (`lib/server/relay.ts`), and each time a handler
signs, the post is answered with what to sign; the browser signs it
(`post` in `@cella/org-ui`) and posts the proof back to the run, which
goes on to its next signature, a reaction's, or to its outcome
([trust](trust.md#keys-and-addresses)). The server holds no member's key,
in dev mode or not; dev mode (`cella serve`) only offers the fixture
members on the sign-in page, whose TEST-ONLY keys the browser derives.
Until `POST /api/<feat>/<verb>` is served, these form actions are the
writes' only HTTP path.

### Reading at scale

A collection is read in SQL, a page at a time. `@cella/org-db` composes
its owner's select, the selects of the extensions that add rows, and one
join per extension that adds fields into one statement (`src/read.ts`),
each row the JSON of its fields; the view's conditions, its text filter,
the collection's order and the page's limit run in it, so the server
holds a page of rows and Postgres the rest. The same statement counts
the rows each tab keeps and that the sidebar counts, gives each
enumeration's values, and runs a dashboard's or the home's widgets as
SQL aggregates. A field is read in SQL as the row holds it under the
column's key, so a slice's select returns what each badge and date
column shows under its key, already derived, such as an invoice's
standing, overdue past its due date; `value` only reads it. The text
filter matches the values under every column's key. The address holds
how many rows are drawn (`n`, a hundred more each time "Show more"
asks) and the text filter, which the page puts there once the typing
pauses; a board and a calendar place every row the view keeps. The
viewer's own views live in their browser, so their tabs' counts are
asked as JSON beside the collection's page (`GET /[collection]`, its
`where` a list of each view's conditions). "Today", for a date's month
or year and for every page, is `cella.verdict_date()`, the day in the
scope's timezone ([the notary](../../apps/org/core/notary/index.md#settings)).

The UI core, `@cella/org-ui`, holds the tokens and every component the
slices compose ([its doc](../../apps/org/core/ui/index.md)); a slice's
blocks style nothing themselves.

## The analytics shell

Analytics are read apart from everything else, by the **analytics
shell**: a DuckDB 2.0 server per scope that reads the views the slices
publish in their analytical contracts ([above](#analytical-contracts))
and joins them. Every join across slices for a report happens there and
only there; a guard that decides a write stays in its slice, through the
notary, and the shell only describes.

It is no third root and no package: a node's roots assemble packages
into a binary or a shell, and the analytics shell assembles nothing. It
is DuckDB itself, the flake's DuckDB 2.0 with the extensions it loads,
run by the CLI beside the Postgres cluster as a process with its
settings ([`cella analytics`](../../apps/org/rs/index.md#commands)). Its
one piece of code is the port's implementation, which the org app's
server holds through `core/analytics` ([the port](../../apps/org/core/analytics/index.md)).

The server attaches the scope's database read-only, logging in as
`cella_analytics` (`ATTACH … (TYPE postgres, READ_ONLY)`), with its
filters and its columns pushed down to Postgres and its catalog checked
for a migration's changes before it serves a cached one. It serves over
quack, DuckDB's client-server protocol, on localhost, to whoever holds its
token, `.data/analytics/<port>/token`, made owner-only on first start.
Before it serves, it turns off every access outside: no file read or
written, no other database attached, no extension loaded, and no setting
changed after ([trust](trust.md#the-analytics-role)). DuckDB's remote
pushdown, which ships a whole query to Postgres, is a `CONNECT` to
Postgres and not an attach, so the shell does not use it: the joins
stay in the shell.

A feat or a page reads through **the port**, `core/analytics`: it hands
the port a report, the views it reads, how they join, the fields, the
filters, the groupings and the measures, never SQL. The port checks it
against the catalog, the views the role reads and their columns, refuses
every field, join or value the catalog does not allow, and compiles it
to one statement. The shell's implementation runs it on a connection of
its own in one transaction, which the attach opens as one Postgres
transaction, repeatable read and read-only: it reads the log's head,
which the port publishes as `analytics.head`, the catalog and the report
on one snapshot, and stamps the result with that head. The org app's
server makes the implementation at assembly from what `cella` hands it,
and a feat calls the port it is handed: the `report` feat's server side
is made with it (`reporting(port)`), and the root hands the home's pins
over a report to that feat's rows. Where `cella` hands no shell, a run
fails with why and a report's page says so.

In development `cella db start` starts the shell on the dev database at
`CELLA_ANALYTICS_PORT` (54343) after the cluster, `cella db stop` stops
it first, and `cella serve` starts it when it is stopped. A host runs it
as a unit of its own beside Postgres
([operations](operations.md#the-analytics-shell)).

## Actions

Every change to the records is an action: one change, voting and closing
included, that an actor signs as an attempt, or that a passed motion
carries, and that passes the guards before it takes effect. Whoever signs
is an actor, by their address (`cella.actor()`): a person, the one kind
built. An agent, an AI, and a service, automation, are actors too, named
and not built: each would hold only limited, termed mandates a motion
can revoke, with someone answerable for it, and no participant role
unless a procedure says so.

Every action is `POST /api/<feat>/<verb>` and maps to one permission, its
id `<feat>:<entity>:<verb>`, declared in the feat's `models/actions.ts`
with its label:

```ts
export const actions = {
  'membership:member:invite': confluent({ power: 'invite-member' }),
  'membership:member:admit': ordered({ decide: 'consent', power: 'admit-member' }),
} satisfies Actions
```

The label is part of the type: an ordered action returns `Pending` until its
verdict. The labels and the path each takes are in [trust](trust.md).

A label also names the power the action needs, the developer's label for
what it needs, and the payload field its
amount is in when a mandate's limit caps it:
`confluent({ power: 'pay-supplier', amount: 'amount' })`. The source of
truth is the row the feat's SQL registers in `cella.power`, which the
`circle-membership` graft's guard reads, or for an action a motion
carries the row in `motion.cites`, or for a stance the row in
`motion.stance_power`; the label mirrors it for the
TypeScript, and `cella check feats` refuses any difference, and any
action declared outside a `models/actions.ts`. Every action is signed by
a device of its actor and carries its request
([signatures](signatures.md)).

**Every circle has a participant role**, built in, which every seat in
it holds there: a seat brings its own role, if any, and the circle's
participant role besides, and a seat above brings no participant role
below. The participant's mandates cover proposing and discussing:
`propose`, to propose a motion of the circle and close it, and
`discuss`, to post on a motion's deliberation, in the circle's channel
and on its meetings' agendas. They are mandates like any other, policies
the assembly adopts, since `participant` is a role every circle has
(`*`). `circle_membership.may` finds them on any seat the actor holds,
and the guard of the graft that knows which circle the action concerns
narrows them to a seat in that circle
([circle](../../apps/org/feats/circle/index.md#the-participant-role)).

**A mandate is individual or collective.** An individual mandate is on
a role, and whoever holds a seat with that role uses it. A collective
mandate is on a circle as a whole, and is used only by a motion of that
circle: an action a passed motion carries (an admission, an adoption, a
seat, a nesting) needs the power its collective mandate grants, which
the action's graft registers with it in `motion.cites` by
`motion.register_cite` rather than in `cella.power`, so no seat's
mandate allows it. `circle-motion` checks it twice: when the motion is
proposed, that its circle holds a collective mandate for the power of
every action it carries (`motion.carries` names the action that carries
out each kind), and on the verdict date of each write citing the motion,
that it still does; an admission, which settles inside the close, is
checked at the proposal alone. Both kinds are carved from what the circle above
holds ([circle](../../apps/org/feats/circle/index.md#authority)).

**A right is a mandate people hold as such**, with no seat: every
person, every member or every employee (`{right: member}`), never an
agent or a service. Who holds a right on a day is said by person's
core, which every kind of person nests in: `person.holds(actor, right,
day)` asks the function each kind registers by `person.register_right`,
`person` itself the known people, `membership` the active members by
`membership.active`, `employment` those employed by
`employment.employed`, so person's core knows none of its children by
name. `circle-membership`'s guard on every op with a power takes a
right's mandate, found by `circle_membership.entitled`, as it takes
one on the actor's seats, so a person with no seat holds their rights
all the same. A right lets each act on what is their own, and so is
never the authority a read asks (`circle_membership.may`): holding
`keep-profile` opens no one else's profile, nor `log-time` another's
time. A right is the assembly's to grant, as a role every circle has
is, and reaches the whole co-op: it is neither carved nor carved from.
What was once the actor's own is a right's power, and the guard that it
is their own stays the feat's: a person keeps their profile and devices
(`keep-profile`, `keep-devices`), uploads a file (`upload-file`), takes
up an invitation (`accept-invitation`), files a record of their own
(`file-record`), marks a text read (`mark-read`) and records an import
(`record-import`); a member draws on their account (`draw-account`),
spreads what they owe (`spread-capital`), marks their attendance
(`mark-attendance`) and saves a report (`save-report`); an employee
logs, corrects and submits their own time (`log-time`), on a project or
not, and claims their expenses (`claim-expense`)
([circle](../../apps/org/feats/circle/index.md#rights)).

**Any person may hold a seat.** A seat is a person's place in a circle,
member or not, and only the assembly's seats ask an active membership:
`circle_membership.counts(person, circle, day)` says whether a seat
counts on a day, in the assembly where membership says the person is
active, in any other circle unless membership has suspended them or let
them go. A worker who is no member sits in their working circle, by a
motion of the circle above it as any seat is given, and holds that
circle's mandates there, its participant's among them. A seat is how
someone takes part in a circle; what is their own is still a right's,
so a worker logs their time by their employment wherever they sit
([circle-membership](../../apps/org/grafts/circle-membership/index.md)).

**Who may vote or veto is the procedure's.** A motion's roll is what
its procedure says: by default the people seated in its circle on the
day it was proposed, never an agent or a service; a procedure may name
the roles whose seats vote (`{voters: lead}`) and those that may veto
(`{veto: lead}`), each a value of its sentence copied into
`motion.procedure`. A seat above carries no vote below: the roll reads
the seats of the motion's own circle alone. A stance needs `vote`, the
power a procedure gives the seats on the roll and no mandate grants: the
motion feat registers it in `motion.stance_power`, and
`circle-membership-motion`'s guard `on_roll` judges it, the actor on the
roll and their seat counting on the verdict date
(`circle_membership.counts`), so a worker who is no member votes in
their working circle and not in the assembly. A stance against, or an
objection, by someone on the roll in a veto role is a veto, and the
motion does not pass whatever the count. Delegates, people chosen to
vote for others at a higher level, are part of a procedure's
configuration and not built
([circle-membership-motion](../../apps/org/grafts/circle-membership-motion/index.md)).

No action is allowed by omission: every action declares the power it
needs. The one that cannot is the log's first entry, which carries in
once the state a scope held before its log, before any mandate is
adopted: it declares the check `first` instead, backed by a guard
registered on it in `cella.guard`. A stance is no check: it
needs the power its procedure gives the seats on the roll, and `cella
check feats` refuses `check: 'roll'`. What is the actor's own is no
check: it needs the power their right grants, and `cella check feats`
refuses `check: 'self'`. Nor is a seat: what a seat allows is its roles' mandates, the
participant's among them, and `cella check feats` refuses `check:
'seat'`; nor is a passed motion, which allows what its circle's
collective mandates grant, and `cella check feats` refuses `check:
'decided'`. A power is backed by SQL: an individual mandate's or a
right's by a row in `cella.power`; a collective mandate's by a row in
`motion.cites`, to which `motion.register_cite` attaches
`circle-membership-motion`'s guard, that the motion passed on its roll,
and `circle-motion`'s, that its circle holds the power; and the voting
power by a row in `motion.stance_power`.

`cella check feats` refuses, each with a negative test in
`tools/_tests/powers.test.mjs`: an action that names neither a power
nor `first`, or `first` with no guard on it; a power no SQL registers;
a label and its SQL that name a different power or amount; and a power
that no mandate, collective mandate or right grants among the policies
a fixture's co-op adopts by its closed motions, Lanterne's, but `vote`,
which a procedure gives. So every action someone can take is one a
co-op can grant, and a fixture shows who holds it. That a guard does
what its check or its power says is its owner's and its tests'. An
action not yet built is not declared: recovering a key from guardian
shares comes with the power it needs and the mandate that grants it
([person](../../apps/org/feats/person/index.md#powers)).

Every critical invariant is enforced twice: the handler checks the
permission and the feat's row-level policies and triggers back it up. An
ordered action is checked a third time by the notary, in a way anyone can
replay from the log. An action's state lands only inside a transaction
that `cella.begin` opened and `cella.submit` settled: the notary's
trigger on every table a feat or a graft makes refuses a row written
outside one, and a begun transaction commits only with its verdict, so
authorisation and logging hold for every state change but a
superuser's ([trust](trust.md#one-server)). `write` in `@cella/org-db`
begins, writes and submits, and a handler writes through it alone.

## Policies

A **policy** is one binding sentence a circle adopted by motion. It is of
one of three kinds: a **mandate**, who may do something; a **rule**, what
else the co-op agreed; a **procedure**, how a circle decides. Its legal
wording is the sentence that binds, each value in it marked once by a
name, `{name: value}`:

```text
Associations and small co-ops pay the solidarity rate, {rate: 20 %} below the rate card
```

The value's type is how it is written: `3 000 €` an amount in cents,
`20 %` a share, `2026-01-01` or `1 January 2026` a day, `10` a number; a
value named `role` or `power`, or ending so, a role's or a power's id;
anything else text. A policy may carry a friendly wording beside the
legal one, in plain words, which never binds and marks no value, so a
value exists once.

A **rule**'s value that is ordered, an amount, a share, a day or a number,
declares which way is stricter after a bar, `| more is stricter` or
`| less is stricter`, so a policy that tightens a rule can be told from
one that loosens it; a text, a role or a power has no order and declares
none. A rule's ordered value with no direction is refused when its
motion is proposed and again when it is adopted. The direction is in the
legal wording and the register (`policy.value.stricter`), never in the
sentence as it reads:

```text
Each associate subscribes at least {account_minimum: 20 | more is stricter} shares
```

A rule may mark no value, and then binds by people's judgement alone: no
guard reads it.

**The register** is org's core library `policy` (`core/policy`), with
its schema `policy` ([its doc](../../apps/org/core/policy/index.md)). It
keeps every policy: its circle and kind, its wordings, its values, the
motion and the action of it that adopted it, by which it is named
(`m-2026-013/1`), the day it applies from, the day it ends, the
policy it replaces, the motion's action that ended it and the procedure
by which alone it is changed, if it names one. It is a
core's, as the notary is, so it knows no feat: a motion is named by its
id, and no foreign key leaves the schema. Unlike the notary, it has rows
written at run time, and two functions write them all, `policy.adopt`
and `policy.end`, which run with their owner's rights and which only the
app may call, inside the write of the action that adopts or ends the
policy; its tables are state tables, so the notary's trigger refuses a
row outside a write. A slice's SQL may read the register's
policies and values, never `policy.wording`, which `cella check feats`
refuses and the guards role is granted nothing on. A guard may quote a
policy in the reason it refuses, by `policy.says(id)`, the sentence as it
reads, and decides by its own columns alone.

**Adoption** is an action a motion carries, `policy` in `motion.carries`,
which the motion feat registers itself, since a policy is a sentence a
circle adopts and only its circle's motion may adopt it: proposed with
its kind and wordings, checked sound as the motion is proposed
(`motion.asks`), and carried out once the motion passes as the motion
feat's `motion:policy:adopt`, which cites the motion. The policy is its
motion's circle's, applying from the day the action names or the verdict
date, whichever is later. A policy replacing another of its circle and
kind ends that one the day it applies. **Ending** one is an action too,
`end` in `motion.carries`, carried out as `motion:policy:end`: a motion
of the policy's circle ends it on the verdict date.

**A protected policy** names the procedure by which alone it is replaced
or ended, its adoption's `protected` argument, which the register keeps
by the procedure's name (`policy.policy.protected`). A motion that
replaces or ends it is refused, as it is proposed and again as its action
is carried out, unless it is decided by that procedure or a stricter one,
and its refusal says which it needs. A procedure is at least as strict as
another when every count that passes by it passes by the other too: the
same method and roll, a quorum and a share no lower, and every veto the
other gives (`motion.as_strict`,
[protected policies](../../apps/org/feats/motion/index.md#protected-policies)).
A policy naming a procedure looser than the one its own motion is decided
by would protect it from nothing, and is refused; one stricter, or one
neither stricter nor looser, protects it. Rights, and mandates that hand
out mandates (granting, revoking and seating), start protected: Lanterne's
founding motion adopts them protected by its extraordinary assembly's
procedure.

**Values bind where they are read.** The feat that reads a kind of
policy copies its values into typed rows of its own as the policy is
adopted, on the same verdict date, so a guard reads a real column, never
the sentence: a feat's write the adoption calls, or carries once it
settles, through the graft joining that feat to `motion`. A guard never parses a wording, and reads the
register only to know which policies are in force. So a procedure policy's
method, share, quorum and ballot are copied by the motion feat into
`motion.procedure`, which a motion is counted by
([procedures](../../apps/org/feats/motion/index.md#procedures)); the
procedures a scope starts with, consent, majority, two thirds and
election, are built in, and name the policy that adopts them once their
scope's root does. A mandate policy's role, circle or right, power and limit
or budget are copied by the circle feat into `circle.mandate`, which
`circle_membership.may` reads for a role's, `circle_membership.entitled` for a right's and `circle-motion` for a
circle's, through `circle-motion`, whose adoption
and ending of a policy are the motion feat's with the circle feat's copy
in the same write
([mandates](../../apps/org/feats/circle/index.md#mandates)).

A rule whose values are named for a feat, as `account_minimum`, is that
feat's to read, and marks every value the feat reads of it. The capital's
terms are the account feat's rule (`account_share`, `account_minimum`,
`account_instalments`, `account_delay`, `account_repayments`), copied
into `account.terms`; the work share's terms the patronage feat's
(`patronage_salary`, `patronage_hours`, `patronage_equal`,
`patronage_capital`, `patronage_interest`), copied into
`patronage.terms`. The adoption's own write reaches only the grafts of
the feats that carry it out, so these are copied by a reaction: once the
adoption settles, the graft joining the feat to `motion`
(`account-motion`, `motion-patronage`) carries the feat's own write,
`account:terms:adopt` or `patronage:terms:adopt`, which cites the motion
and copies the values on the same verdict date. So that no rule is
adopted whose values its feat would refuse, the same graft's guard on
the proposal checks them as the feat does (`account.terms_flaw`,
`patronage.terms_flaw`). Terms are replaced by later terms, never ended,
since a co-op always has its terms.

**The statutes are the co-op's policies in order**, generated and never
written. A document may be generated from a circle's policies
(`document.generated`): its template is the fixed text of the co-op's
legal form, with a `policies` block where they read, and each policy of
the circle in force reads there in its legal wording as it reads, a
replacement where the policy it replaces read. The statutes are the
root circle's. A policy's adoption or ending writes no document, since
only the grafts of the feats carrying it may extend it; once it settles,
`document-motion` carries the document feat's `document:document:generate`,
which cites the motion, generates the document from the policies in
force on the day the change applies, and saves and adopts it as a new
version in one write, whose log entry commits to the version's hash.
So the statutes are frozen at each adoption, and every earlier version
still reads. The document feat's guard holds the version to the
register: every policy of the circle in force that day reads in it, and
no other of its policies. A generated document is never edited,
versioned or adopted by hand
([generated documents](../../apps/org/feats/document/index.md#generated-documents)).
Minutes, contracts and letters stay ordinary documents, edited and
adopted as their own text.

A circle's page lists its policies in force, each as its legal wording
reads, with the motion that adopted it and its days (`circle-motion`).
A row-level policy, which says which rows a reader sees
([SQL](#sql)), is always called that, and is never a policy.

## Feat flags

A feat's `feat.toml` names it, its group (governance, work, finance,
platform), whether it is built in, the rung it arrives at and the grafts it
declares. Groups are for navigation only; they are a field, not
directories. A co-op enables the feats it uses; a disabled feat's pages are
not served and its jobs and subscriptions go inert. Built-in feats are
always on.
