+++
title = "Enforcement"
updated = 2026-11-16
+++

# Enforcement

Every rule of [AGENTS.md](../../AGENTS.md#rules) and of
[architecture](architecture.md) is enforced by a tool wherever a tool can
see it. This page lists each rule once: where it is stated, the tool and
the check that refuses a breach of it, and the negative test that proves
the check refuses. A rule no tool can see says so here and in the section
that states it, and review holds it. Architecture labels each of its
clauses by the same reading, *enforced* or *convention*
([labels](architecture.md#labels)); this page gathers them with their
negative tests.

`cella check` runs the checks: `cella check feats` runs
`tools/feat-check.mjs`, which calls `tools/sql-check.mjs`,
`tools/powers.mjs`, `tools/writes.mjs`, `tools/ui-check.mjs` and `tools/tabs.mjs`;
`cella check fixtures` runs `tools/fixture-check.mjs`, and `cella check
pruned` builds core alone by `tools/prune.mjs`. `cella migrate` refuses
by `tools/migrations.mjs` as it runs. `cella test tools`
runs their negative tests in `tools/_tests/`, and `cella test e2e` the
end-to-end tests in `apps/org/ts/_e2e/` that prove a refusal made at
run time. The gates run `cella check` and `cella test`, so a check whose
negative test stops refusing turns the gates red.

A rule's row is changed in the commit that changes how it is enforced.

## The rules

Short names: fc `tools/feat-check.mjs`, sc `tools/sql-check.mjs`, pw
`tools/powers.mjs`, wr `tools/writes.mjs`, ui `tools/ui-check.mjs`,
`T/` for `tools/_tests/` and `_e2e/` for `apps/org/ts/_e2e/`.

| Rule | Stated | Refused by | Negative test |
|---|---|---|---|
| A package depends only on what the tree allows | [what may depend on what](architecture.md#what-may-depend-on-what) | fc, the tree's edges | `T/tree.test.mjs`: a parent never builds on its child; a graft reads no core of a feat it does not join, nor a graft above its node; none for a feat on its sibling |
| A core feat uses no other core feat, in code or in SQL; a core graft joins them | [core grafts](architecture.md#core-grafts) | fc, on core's packages; sc, on core's SQL | `T/tree.test.mjs`: a core feat never builds on another core feat; a core library builds on no core feat; a core graft builds on no core feat it does not join; `T/core.test.mjs`: a core feat acting in another core feat; a core feat reads no other core feat's schema; a core graft reads no core feat it does not join |
| A core graft makes only in its own schema, and alters a core feat it joins only to put it under the circles' row-level policies | [core grafts](architecture.md#core-grafts) | sc | `T/core.test.mjs`: a core graft creating, altering or granting anything else in a core feat it joins; a core graft binds the owning circle of a core feat it joins, and alters nothing else of it |
| Core and the shell stand with every feat removed | [removing a feat](architecture.md#removing-a-feat) | `cella check pruned` (`tools/prune.mjs`) and `cella test pruned` (`tools/pruned.mjs`) | `T/prune.test.mjs`: a core package importing a feat; the shell importing a feat outside its composition root |
| The brand, the diagrams and the site sit outside the tree | [what may depend on what](architecture.md#what-may-depend-on-what) | fc, the outside packages | `T/tree.test.mjs`: any package may depend on the brand, which depends on none of the tree; the site depends on the brand alone, and no package on the site; none for the diagrams |
| A graft reads only the feats it joins, their cores, and the grafts at or below its node that join a proper subset of them | [graft order](architecture.md#graft-order) | fc, the tree's edges, in code; sc, "is outside", in SQL | `T/tree.test.mjs`: a graft reads no core of a feat it does not join, nor a graft above its node; none for a graft of equal order, nor in SQL |
| A package's relative imports stay inside it | [what may depend on what](architecture.md#what-may-depend-on-what) | fc, "outside its package" | `T/tree.test.mjs`: an import that climbs out of its package |
| A package exports only its surface, each export's target in the layer its key names | [5. Layering](architecture.md#5-layering), [inside a package](architecture.md#inside-a-package) | fc, the exports and their targets | `T/tree.test.mjs`: an export of `./internal`; an export whose target leaves its layer |
| Nothing re-exports around the tree | [5. Layering](architecture.md#5-layering) | fc, "re-exports", each import resolved through the dependency's alias and the package's `imports`, a conditional entry through every target it names | `T/tree.test.mjs`: a module that re-exports another package, by `export … from` or by exporting a name it imported; a re-export through an aliased dependency; a re-export through a conditional `#` import whose later target names another package |
| Only a shell imports a slice's app | [5. Layering](architecture.md#5-layering), [5.1 Composition](architecture.md#51-composition) | fc, "only a shell imports" | `T/tree.test.mjs`: a feat importing another's app; a graft importing a feat's app through a `#` import; a feat importing another's app through a conditional `#` import whose `default` names it |
| A server or client layer imports only the layers inside it | [inside a package](architecture.md#inside-a-package) | fc, by each file's path and each import's; ui refuses a client import of a server layer | `T/tree.test.mjs`: a model importing a handler; a handler importing a driver; a hook importing a component; `T/ui.test.mjs`: a client import of a server layer |
| A graft sits at the lowest node and joins no feat with one nested in it | [grafts](architecture.md#grafts) | fc | `T/tree.test.mjs`: a graft sits at the lowest node that holds every feat it joins; a graft never joins a feat with one nested in it |
| A graft is named in order and declared by a feat it joins; a feat's name has no hyphen | [grafts](architecture.md#grafts) | fc | `T/tree.test.mjs`: a graft out of order; a graft no feat it joins declares; a feat named with a hyphen |
| A feat's name is unique in its app | [feats](architecture.md#feats) | fc | `T/tree.test.mjs`: a feat's name is unique |
| Circles and people are core, and no graft joins either | [circles are core](architecture.md#circles-are-core), [people are core](architecture.md#people-are-core) | fc, a graft joins no core feat; sc, a slice names a person only as it names a circle | `T/tree.test.mjs`: a graft never joins a core feat; `T/powers.test.mjs`: a feat and a graft name a core person as they name a circle, and reach no further into the people |
| An action is declared in its slice's `models/actions.ts`, named for it | [actions](architecture.md#actions) | fc; tsc on `satisfies Actions` | `T/tree.test.mjs`: an action declared outside it, or in a `models/ops.ts`; an action not its feat's own |
| Every action declares the power its SQL registers, or `first` | [actions](architecture.md#actions) | pw | `T/powers.test.mjs` |
| A check is never a stance, a seat, a passed motion or the actor's own | [actions](architecture.md#actions) | pw | `T/powers.test.mjs`: a stance is no check; a seat is no check; a passed motion is no check; what is the actor's own is no check |
| A mandate, collective mandate or right Lanterne adopts grants every power | [actions](architecture.md#actions) | pw | `T/powers.test.mjs`: a power no mandate grants |
| Every action folds | [folds](architecture.md#folds) | pw; every e2e scenario's log folds into a fresh database, but one marked `// unfolded:` | `T/powers.test.mjs`: an action with no fold |
| A slice registers its folds and follows under its own name, in its own schema | [folds](architecture.md#folds) | sc | `T/writes.test.mjs`: a fold registered not as itself |
| An `on:` cause is registered in `cella.follows` | [writes stay home](architecture.md#writes-stay-home) | fc, "reacts to" | `T/powers.test.mjs`: an `on:` cause no `cella.lets_follow` registers |
| Only the notary's functions write the log | [SQL](architecture.md#sql) | sc, a slice or a core library writes `cella.*` only to register; wr, only the notary's TypeScript writes `cella.*` | `T/powers.test.mjs`: a feat registers powers only on its own ops, as literal rows, under its own name; only a feat registers the keyring, and nothing else in cella is written; `T/writes.test.mjs`: a core library's SQL writes cella.* only to register; a core library's or a slice's TypeScript that writes the log |
| A handler writes through `write` and never writes the log or opens the notary's transaction itself | [actions](architecture.md#actions) | wr, a call of `cella.begin`, `cella.submit` or `cella.follow` in any package but `@cella/org-db`; the notary at run time | `T/writes.test.mjs`: a handler that calls cella.begin, cella.submit or cella.follow itself; `_e2e/notarised.test.ts`, at run time: a handler that skips submit commits nothing |
| A feat's or graft's table refuses a row written outside the notary's transaction | [SQL](architecture.md#sql) | the notary's trigger at run time; no check sees it statically | `_e2e/notarised.test.ts`: every table a feat or a graft made is registered; a psql write is refused, as the app or as a superuser |
| A slice's SQL references only the schemas it may | [SQL](architecture.md#sql) | sc, "is outside" | `T/powers.test.mjs`: a feat reading a peer feat's schema; a graft reading a higher-order graft's; `T/core.test.mjs`: a core feat reads no other core feat's schema; `T/contract.test.mjs`: core and analytics |
| A slice creates and grants only in its own schema | [SQL](architecture.md#sql) | sc | `T/powers.test.mjs`; `T/contract.test.mjs`; `T/policy.test.mjs`: a slice makes nothing in the register's schema |
| No foreign key crosses a feat, and every table names its owning circle or is a registry | [SQL](architecture.md#sql) | sc | `T/powers.test.mjs`: every table names its owning circle, and one holding a foreign key into another feat's is refused |
| Writes stay home, in SQL and in TypeScript | [writes stay home](architecture.md#writes-stay-home) | sc and wr; SQL built at run time and an unqualified target are review's, as that section says | `T/writes.test.mjs` |
| A table's rows are read through forced row-level policies of the known patterns, and a share is declared | [reading](architecture.md#reading) | sc; migrate's `circle.unsecured` | `T/reads.test.mjs`; a share's why, the powers a feat names in `cella.reading`, what a graft's `cella.reach` opens and a server reading past the port are review's, as that section says |
| A definer function or an owner-rights view is declared and sums or filters | [reading](architecture.md#reading) | sc | `T/definers.test.mjs`; `T/views.test.mjs` |
| A query written in SQL is a view in its slice's own schema, within its reach, that reads as its reader | [queries in SQL](architecture.md#queries-in-sql) | sc (`unshared`); the shell's registry, on the view's schema | `T/views.test.mjs`: a query that reads as its owner, declared shared or not; a query past its slice's reach; none for the registry's, which refuses as the shell starts |
| An analytical contract keeps its rules, and nothing grants to `cella_analytics` | [analytical contracts](architecture.md#analytical-contracts) | sc | `T/contract.test.mjs`; a shared view's grain is review's, as that section says |
| A slice's analytical contract is its SQL queries: each view it publishes, but a contributions view, is declared a published query | [analytical contracts](architecture.md#analytical-contracts) | sc; the e2e `analytics-shell`, on a declaration's columns | `T/contract.test.mjs`: a published view no query declares, and one declared but not published |
| A slice's SQL reads no clock and no randomness, but `cella.verdict_date()` | [SQL](architecture.md#sql) | sc | `T/powers.test.mjs`: a feat's or a graft's guard that reads `now()`, `current_date` or `random()`; `T/core.test.mjs`: a core library, and core's circles, reading the clock in a guard |
| Only core's circles and the notary read the role a session runs as | [SQL](architecture.md#sql) | sc | `T/core.test.mjs`: a core library other than the circles reading the role; a core graft reading the role; a slice reading the role |
| A slice's SQL holds no `DO` block and sets no `search_path` but a function's, to the catalog; it is `sql` or `plpgsql`, sits in a `sql/` directory and parses | [SQL](architecture.md#sql) | sc | `T/powers.test.mjs`: a `DO` block, a `search_path`, a `plpython3u` function, a `.sql` file outside `sql/`, a file that does not parse |
| A guard never reads `policy.wording` | [policies](architecture.md#policies) | sc | `T/policy.test.mjs`: a guard that reads a policy's wording |
| A feat that keeps a body or threads keeps them whole: their commands with `discuss`, their folds, the session's mount, the mention table and the reaction guard | [threads](../../apps/org/core/body/index.md#threads) | fc, "keeps a body", "keeps threads" | `T/threads.test.mjs`: a body with no save, a save needing another power or with no fold, a body no session mounts; threads with no post, resolve or react, no mention table, no guard on react |
| A slice reads a setting by `circle.setting_of`, never `circle.setting_value` | [settings](architecture.md#settings) | sc | `T/settings.test.mjs`: a guard that reads `circle.setting_value` |
| A guard is never re-implemented in TypeScript | [SQL](architecture.md#sql) | no tool can see it | none |
| A guard refuses early, says what would fix it, and names no person | [early and actionable](architecture.md#early-and-actionable) | no tool can see it | none |
| A guard lives at the lowest level that owns it | [guards](architecture.md#guards) | sc, a graft guards only the ops of the feats it joins; the lowest level itself no tool can see | `T/powers.test.mjs`: a graft registers guards on the ops it joins |
| Personal data never enters the log | [trust](trust.md#personal-data) | sc, a column that may hold personal data is declared; e2e folds commitments | `T/powers.test.mjs`: a column that may hold personal data |
| A migration that applied is never edited or gone | [migrations](architecture.md#migrations) | `cella migrate` (`tools/migrate.mjs`), by `edited` in `tools/migrations.mjs` on the hash of each applied file | `T/migrations.test.mjs`: a database that applied a file since edited is refused; one that applied a file since gone or renamed |
| The notary changes by an upgrade, never by a drop | [operations](operations.md#upgrades) | sc, `DROP EXTENSION cella` in every `sql/`, core's and the notary's among them | `T/powers.test.mjs`: no migration drops the cella extension, the notary's neither |
| The client keeps its state in hooks, its style in UI core, and no module-level state or server import | [client state](architecture.md#client-state) | ui | `T/ui.test.mjs` |
| A create form opens only in New's Dialog; a page holds no create form | [the UI](../../apps/org/core/ui/index.md#components) | ui (`inlineCreates`), a component importing a create form a slice's app declares, and the UI core drawing a collection's creates outside its Dialog; a block's form creating a record of another kind on its own page no tool sees, and review holds it | `T/ui.test.mjs`: a create form drawn inline on a page is refused by name; the collection's creates drawn outside the Dialog |
| A report reads only the views the slices publish, through the port, and joins slices in the analytics shell alone | [the analytics shell](architecture.md#the-analytics-shell) | the port at run time, `apps/org/core/analytics/ts/src/check.ts`; a server reading past the port is review's, as [reading](architecture.md#reading) says | `_e2e/analytics-shell.test.ts`: the port refuses a report that reads past the catalog; a running shell is refused for another database |
| The shell writes no SQL | [the shell](architecture.md#the-shell) | wr, a write of a table or a call of the notary in the shell's TypeScript; a read in SQL no tool can see | `T/writes.test.mjs`: the shell's TypeScript that writes a table or calls the notary |
| Never native components: no select, date input, checkbox or radio of the browser's in the org app | [the shell](architecture.md#the-shell), [the UI core](../../apps/org/core/ui/index.md#never-native) | ui, "never native components", on an org `.svelte` file's markup | `T/ui.test.mjs`: a native `<select>`, a date and a datetime-local input, a checkbox, a switch and a radio, each refused by name; the UI core's `Select`, `Checkbox` and date `Field` passing |
| A route has no server load or actions; the web shell reads through a slice's calls |
 [remote functions](architecture.md#remote-functions) | ui | `T/ui.test.mjs`: a route's server load or actions, or a universal load |
| A graft extends only the collections of the feats it joins | [the shell](architecture.md#the-shell) | the shell's registry as it loads, `apps/org/ts/src/lib/server/slices.ts`; no check sees it before | none |
| A collection has one owner, a write one extension replacing it, and an address one command | [the shell](architecture.md#the-shell), [remote functions](architecture.md#remote-functions) | the shell's registry as it loads, `apps/org/ts/src/lib/server/slices.ts`; no check sees it before | none |
| A record's page shows at most four tabs, its owner's, an extension placing its blocks in them and declaring none | [the shell](architecture.md#the-shell) | fc, by `tools/tabs.mjs` on each `App` literal; the type of an extension's page leaves `tabs` out | `T/tabs.test.mjs`: a page declaring five tabs, and an extension placing a block in a tab of its own, each refused by name |
| The site's text is the operator's | [whose words](../../apps/site/index.md#whose-words) | `.claude/settings.json` and `tools/site-text-guard.mjs` on an agent's calls; `cella check`, by a commit's author (`tools/site-text-check.mjs`), against accidents and not attackers | `T/site-text-guard.test.mjs`; `T/site-text-check.test.mjs`: a commit to the text by another author, refused by name, and the operator's passing; another author's merge whose resolution changes the text, refused, and one that only brings the operator's commits in, passing |
| A test file sits in a slice's `_tests/` or an app's `_e2e/` | [tests](architecture.md#tests) | `cella test`, by where each file sits | `apps/org/rs/src/test.rs`: `a_test_file_elsewhere_is_refused`, run by `cella test cli` |
| Docs are present-tense, and a feat's change updates its doc's `updated` | [AGENTS.md](../../AGENTS.md#rules) | no tool can see the tense; nothing checks `updated` | none |
