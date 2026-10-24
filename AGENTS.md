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
  own. Only the extension's functions write the log; a handler calls
  `cella.submit` inside its transaction and never writes the log or settles
  an ordered write itself.
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
- **SQL is the source of truth for rules.** Never re-implement a rule in
  TypeScript; never call `now()` in a rule, read `cella.verdict_date()`.
- **A rule lives at the lowest level that owns it**: a feat, a graft, or a
  node's core only when it spans everything below.
- **Personal data never enters the log.** Commit to it; keep it in the vault.
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
