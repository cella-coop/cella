# Cella

An ERP for member-governed organisations: co-ops and partnerships. Each
co-op has its own database and notary. Cella orders the writes that contend
and signs each verdict into a log the members can audit.

- [Architecture](_corpus/doc/architecture.md) — feats, their cores and grafts,
  and what may depend on what.
- [Trust](_corpus/doc/trust.md) — the three kinds of write, the notary and
  the log, keys, personal data.
- [Ratchet](_corpus/doc/ratchet.md) — the rungs from a hosted pilot to zero
  trust.
- [Users](_corpus/doc/users.md) — who cella is for, starting with
  professional-services worker co-ops.
- [Glossary](_corpus/doc/glossary.md) — cella's terms and the co-op terms it
  uses.
- [Conflicts](_corpus/doc/conflicts.md) — every write against the
  invariants it contends with, testing each label.
- [Org](apps/org/index.md) — the app and its feats.

## Layout

This repository works only on the org app.

- `apps/org/` — the ERP: its core (`ops`, `crypto`, `log`, `keystore`,
  `rules`, `notary`, `db`), its feats and grafts, and its roots: `rs/`, the
  `cella` CLI, and `ts/`, which assembles the app.
- `tools/` — the node tools `cella` runs: the feat and fixture checks,
  migrations and seeds.
- `_corpus/` — the repository's docs.

## Develop

`cella` runs every development and production task; see
[the CLI](apps/org/rs/index.md).

```sh
nix develop
cella check       # feat check, fixture check, types, cargo check, clippy; no database
cella db start    # build the cella extension, start Postgres 18 in .data/
cella test        # Rust and tool tests, each slice's tests, then the e2e scenarios
cella log verify  # recheck the dev database's log
cella db stop
```
