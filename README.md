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
- [Org](apps/org/index.md) — the app and its feats.

## Layout

- `apps/org/` — the ERP: its core (`ops`, `crypto`, `log`, `keystore`), its
  feats and grafts, and the root that assembles them.
- `tools/feat-check.mjs` — refuses a dependency the tree does not allow.
- `_corpus/` — the repository's docs.

## Develop

```sh
nix develop
just check
```
