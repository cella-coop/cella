# Agents

Cella is a co-op ERP built as a strict tree of feats. This repository works
only on the org app, `apps/org/`. Read
[architecture](_corpus/doc/architecture.md) before you write, and
[trust](_corpus/doc/trust.md) before you touch a write path.

## Rules

- **A feat imports no other feat.** What feats share goes through a graft
  in their parent's `grafts/`, declared by the feat that extends.
  `cella check feats` must pass; never route around it with a re-export.
- **Every write has a label and a permission** in its feat's
  `models/ops.ts`. A new write without one is incomplete.
- **The notary is the only path that appends to the log.** It is a layer,
  the `cella` extension in org's core, not a feat, and has no writes of its
  own. Only the extension's functions write the log; a handler writes
  through `write`, which opens its transaction with `cella.begin` and calls
  `cella.submit` inside it, and never writes the log or settles an ordered
  write itself. Every table a feat or a graft makes refuses a row written
  outside such a transaction.
- **Grafts compose upward.** A graft joining N feats may read, in code and
  in SQL, the feats it joins and the grafts of its node that join a proper
  subset of them; never a graft of equal or higher order. A relationship
  that needs another graft's data lives in the graft joining all its feats.
- **Each feat and each graft owns a Postgres schema**, its SQL in a `sql/`
  directory beside its core package. A feat's SQL references only its own
  schema and `cella.*`; a graft's, its own, those of the feats it joins and
  those of its lower-order grafts. It creates and grants only in its own.
- **Architecture rules are enforced by tooling** wherever a tool can see
  them: `cella check feats` checks packages, imports, ops and every `sql/`
  file. A rule a tool cannot check says so in its doc.
- **No foreign key crosses a feat.** The graft's schema holds the junction.
- **Writes stay home.** A feat's rows change only through its own code. A
  graft writes only its own schema: it changes a feat by calling that
  feat's published write from its handler, reacts through `on` and
  refuses through a rule, and never inserts, updates, deletes or puts a
  trigger on a feat's or a lower-order graft's table. A nested feat
  writes its parent the same way. `cella check feats` refuses any such
  write that `apps/org/foreign.list`, the shrinking list of exceptions
  that predate the rule, does not name. Never add a line to that list:
  move the write instead ([writes stay
  home](_corpus/doc/architecture.md#writes-stay-home)).
- **Migrations are append-only.** A locked migration is never edited or
  removed: a change is a new file, locked with `cella migrate --lock`, and
  `cella check` refuses anything else. The notary changes by a new
  version's upgrade script and a migration that updates the extension,
  never by dropping it ([operations](_corpus/doc/operations.md#upgrades)).
- **SQL is the source of truth for rules.** Never re-implement a rule in
  TypeScript; never call `now()` in a rule, read `cella.verdict_date()`.
- **A rule lives at the lowest level that owns it**: a feat, a graft, or a
  node's core only when it spans everything below.
- **Personal data never enters the log.** Commit to it; keep it in the vault.
- **A slice's UI is its own.** A feat mounts its collections in the shell
  through its `./api` and `./app` slices; a graft extends only the
  collections of the feats it joins. Blocks compose `@cella/org-ui` and
  style nothing; state lives in a hook's state class; client code imports
  no server layer and keeps no module-level mutable state. The shell
  writes no SQL. See [the shell](_corpus/doc/architecture.md#the-shell).
- **Docs are present-tense** and say what the thing is. A feat's doc is its
  `index.md`; when you change a feat, update its doc and its `updated`.

## Workflow

- `cella` is the one entry point for every development and production task
  ([the CLI](apps/org/rs/index.md)); add a task to it, never a script
  beside it. `cella check` runs the feat check, the fixture check, the type
  check, `cargo check` and clippy. Keep it green before a commit; never
  `--no-verify`.
- Small commits with honest messages, by path: `feat(<feat>):`,
  `doc(<feat>):`, `graft(<a>-<b>):`, `lib(<lib>):`, `chore:`.
- The spec and the code disagreeing is a question for the operator, not
  something to reconcile silently.
