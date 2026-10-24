# Agents

Cella is a co-op ERP built as a strict tree of feats. Read
[architecture](_corpus/doc/architecture.md) before you write, and
[trust](_corpus/doc/trust.md) before you touch a write path.

## Rules

- **A feat imports no other feat.** What two feats share goes through a
  graft in their parent's `grafts/`, declared by the feat that extends.
  `just feat-check` must pass; never route around it with a re-export.
- **Every write has a label and a permission** in its feat's
  `models/ops.ts`. A new write without one is incomplete.
- **The notary is the only path that appends to the log.** No handler writes
  the log or settles an ordered write itself.
- **No foreign key crosses a feat.** The graft owns the junction.
- **Personal data never enters the log.** Commit to it; keep it in the vault.
- **Docs are present-tense** and say what the thing is. A feat's doc is its
  `index.md`; when you change a feat, update its doc and its `updated`.

## Workflow

- `just check` runs the feat check, the type check, `cargo check` and clippy.
  Keep it green before a commit; never `--no-verify`.
- Small commits with honest messages, by path: `feat(<feat>):`,
  `doc(<feat>):`, `graft(<a>-<b>):`, `lib(<lib>):`, `chore:`.
- The spec and the code disagreeing is a question for the operator, not
  something to reconcile silently.
