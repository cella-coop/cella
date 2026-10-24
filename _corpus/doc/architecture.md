+++
title = "Architecture"
updated = 2026-10-24
+++

# Architecture

Cella is built as a tree of **feats**. The root feats of the repository are
its **apps**; apps hold feats, feats hold feats, and **grafts** join feats.
Each feat's **core** holds the libraries its feats inherit. The rules are
corpus's composable architecture as ruled on 2026-10-17, with seedling's
layers inside each package and the write labels of the 2026-10-24 ruling.

## The tree

```mermaid
flowchart BT
  core["apps/org/core: ops, crypto, log, keystore, …"]
  member["feats/member/core"]
  decision["feats/decision/core"]
  graft["grafts/decision-member"]
  root["apps/org/ts: shell, routes, server"]
  member --> core
  decision --> core
  graft --> member
  graft --> decision
  root --> graft
  root --> member
  root --> decision
```

A node is a directory with a `feat.toml`. It holds:

- `core/` — what the feat is, and the libraries its children and grafts
  build on, one package each (`core/<lib>/rs`, `core/<lib>/ts`). The app's
  core is its shared library layer: `ops` (labels, permissions, outcomes),
  `crypto`, `log`, `keystore`, and later `db`, `auth`, `ui`. A leaf feat's
  core is all of it.
- `feats/` — its child feats, the same shape. Nesting stays shallow: what
  everything grafts onto belongs in the parent's core.
- `grafts/` — the joins between its child feats.
- `rs/`, `ts/` — the node's root, which assembles it. Only a node that links
  its feats into a binary or a shell has one.

Every package is an ordinary package in its ecosystem: a crate in `rs/`, an
npm package in `ts/`, one to a directory. The workspaces find them by glob
(`apps/**/ts`, `apps/**/rs`), so cargo, pnpm and editors work unchanged.

## What may depend on what

| A package in | may depend on |
|---|---|
| a feat's core | the other packages of its own core; its ancestors' cores |
| a graft | the cores of the feats it joins; its node's and their ancestors' cores |
| a node's root | its own and its ancestors' cores, its feats' cores and roots, its own grafts |

Nothing is ambient: no global module, no library outside the tree, no
re-export that reaches around it. Third-party crates and npm packages are
the only dependencies from outside. When two apps need the same library, the
repository's root becomes the top node and the library moves into its core.
`tools/feat-check.mjs` reads the manifests cargo and pnpm already read,
places each package by its path, and refuses any other edge. It also checks
that every graft is declared and that every feat it names is a feat of its
node.

## Grafts

A graft owns a relationship between two feats: its model, its junction table
with keys into both, and the handlers that react on either side. It is named
by the feats it joins, in alphabetical order (`decision-member`), so a feat's
name has no hyphen. The feat that extends the other declares it in its
`feat.toml`. A graft has no pages of its own.

No foreign key crosses a feat boundary. A feat handles an unlinked entity
gracefully: an invoice without a client is unbilled, not invalid. The graft
adds the link.

## Inside a package

Seedling's layers, innermost first; imports point inward only.

- Server: `models` (types, schemas, invariants, `permissions`, `ops.ts`) →
  `interfaces` (repository contracts) → `handlers` (`(input, deps) → Result`,
  jobs) → `drivers` (Postgres schema and repositories) → `api` (remotes,
  endpoints, events, subscriptions).
- Client: `hooks` → `components` → `bindings` (sockets, plugs) → `app`
  (pages, views, panes, blocks).
- Tests in `_tests/`.

A package's `exports` name its public surface: `./models`, `./api` and
`./bindings`. Nothing else is importable from outside it.

## Writes

Every write is `POST /api/<feat>/<op>` and maps to one permission,
`<feat>:<entity>:<op>`, declared in the feat's `models/ops.ts` with its label:

```ts
export const ops = {
  'member:member:invite': confluent(),
  'member:member:admit': ordered({ decide: 'consent' }),
} satisfies Ops
```

The label is part of the type: an ordered write returns `Pending` until its
verdict. The labels and the path each takes are in [trust](trust.md).

Every critical rule is enforced twice: the handler checks the permission and
Postgres row-level security backs it up. An ordered write is checked a third
time by the notary, in a way anyone can replay from the log.

## Feat flags

A feat's `feat.toml` names it, its group (governance, work, finance,
platform), whether it is built in, the rung it arrives at and the grafts it
declares. A co-op enables the feats it uses; a disabled feat's pages are not
served and its jobs and subscriptions go inert. Built-in feats are always on.

## Proposed

These calls resolve tensions between the iterations and are not yet ruled:

- **The notary is a feat of org** with an `rs/` root that builds its binary,
  so the libraries it shares with the app stay in org's core.
- **Feats are flat under the app.** Groups are a field in `feat.toml`, not
  directories, so a graft between, say, an invoice and the books sits in one
  place instead of crossing groups.
- **`ledger` is the double-entry books** (chart of accounts and journal), and
  seedling's member capital, reserves and surplus become `capital`.
- **Graft names are alphabetical**, and grafts join exactly two feats.
- **Cross-feat invariants** (nothing posts into a closed period; an exit
  freezes capital) are declared in the parent's core and checked by the
  notary on every ordered write.
- **The check reads `package.json` and `cargo metadata`**, not the pnpm
  lockfile, so it runs before an install.
