# Agents

Cella is a cooperative workspace built as a strict tree of feats. This
repository works only on the org app, `apps/org/`. Read
[architecture](_corpus/doc/architecture.md) before you write, and
[trust](_corpus/doc/trust.md) before you touch a write path.

## Rules

- **A feat imports no other feat.** What feats share goes through a graft
  in their parent's `grafts/`, declared by the feat that extends.
  `cella check feats` must pass; never route around it with a re-export.
- **Every action has a label and a permission** in its feat's
  `models/actions.ts`. A new action without one is incomplete.
- **Every action declares the power it needs**, its SQL registers it,
  and a mandate, collective mandate or right that Lanterne adopts grants
  it; `cella check feats` refuses one that does not. Only the log's
  first entry declares a check, `first`, instead. An action not yet
  built is not declared ([actions](_corpus/doc/architecture.md#actions)).
- **The notary is the only path that appends to the log.** It is a layer,
  the `cella` extension in org's core, not a feat, and has no actions of its
  own. Only the extension's functions write the log; a handler writes
  through `write`, which opens its transaction with `cella.begin` and calls
  `cella.submit` inside it, and never writes the log or settles an ordered
  action itself. Every table a feat or a graft makes refuses a row written
  outside such a transaction.
- **Grafts compose upward.** A graft joining N feats may read, in code and
  in SQL, the feats it joins and the grafts of its node that join a proper
  subset of them; never a graft of equal or higher order. A relationship
  that needs another graft's data lives in the graft joining all its feats.
- **Each feat and each graft owns a Postgres schema**, its SQL in a `sql/`
  directory beside its core package. A feat's SQL references only its own
  schema, `cella.*` and core's circles, `circle.*`; a graft's, its own,
  those of the feats it joins, those of its lower-order grafts and
  `circle.*`. It creates and grants only in its own.
- **Circles, roles, tenures and mandates are core**, as groups are in
  standard RBAC: `apps/org/core/circle`, never a feat, and no graft joins
  a circle ([circles are core](_corpus/doc/architecture.md#circles-are-core)).
- **Architecture rules are enforced by tooling** wherever a tool can see
  them: `cella check feats` checks packages, imports, ops and every `sql/`
  file. A rule a tool cannot check says so in its doc.
- **No foreign key crosses a feat.** The graft's schema holds the junction.
- **Writes stay home.** A feat's rows change only through its own code. A
  graft writes only its own schema: it changes a feat by calling that
  feat's published write from its handler, reacts through `on` and
  refuses through a guard, and never inserts, updates, deletes or puts a
  trigger on a feat's or a lower-order graft's table. A nested feat
  writes its parent the same way; a feat its extenders fill publishes a
  register they call. `cella check feats` refuses every such write, with
  no list of exceptions ([writes stay
  home](_corpus/doc/architecture.md#writes-stay-home)).
- **Until launch, migrations are rewritten in place.** No scope is live:
  a change edits the migration that makes what it changes, and every
  database is rebuilt with `cella db reset`; `cella migrate` refuses one
  that applied a file since edited or gone. At launch they are squashed
  into one initial migration each and become append-only, locked again
  ([architecture](_corpus/doc/architecture.md#migrations)). The notary
  changes by a new version's upgrade script and a migration that updates
  the extension, never by dropping it
  ([operations](_corpus/doc/operations.md#upgrades)).
- **SQL is the source of truth for guards.** Never re-implement a guard in
  TypeScript; never call `now()` in a guard, read `cella.verdict_date()`.
- **A guard refuses as early as it can and says what would fix it.**
  Where a write's terms are known before it is made, as a motion's at
  its proposal, the same SQL judges them then and again when it is
  made; a refusal names what is wrong and what would fix it, with the
  values it read, and never a person in a reason the log keeps
  ([early and actionable](_corpus/doc/architecture.md#early-and-actionable)).
- **A guard reads a policy's values from the reading feat's columns,
  never parses its wording.** A policy is a sentence a circle adopted by
  motion, its values marked in it once; the feat that reads a kind of
  policy copies them into its own typed rows at adoption. `cella check
  feats` refuses a slice's SQL that reads `policy.wording`
  ([policies](_corpus/doc/architecture.md#policies)). Row-level policies
  are always called that, and are not policies.
- **A guard lives at the lowest level that owns it**: a feat, a graft, or a
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
