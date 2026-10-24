+++
title = "Spike: the notary as a pgrx extension"
updated = 2026-10-24
+++

# Spike: the notary as a pgrx extension

**Verdict: go.** On Postgres 18.6 with pgrx 0.18.1, every promise of option C
holds. The extension builds on NixOS and loads. It numbers and signs the log
from a locked head row, and its verdict commits or rolls back together with
the handler's state write. There are two costs: a hard crash in the
extension restarts every backend, and PGlite cannot load the extension.

`./run.sh` reproduces everything. It builds the extension, starts a
throwaway cluster on port 54318, writes each check's output to
`$SPIKE_SCRATCH/out/` and stops the cluster. The extension is in `ext/`, the
checks in `sql/` (composed rules in `sql/rules/`), and the loader,
transaction test and checker in `node/`.

| # | Question | Result |
|---|---|---|
| 1 | Builds and loads on PG 18 | yes |
| 2 | `cella.amount` | yes; operators need `cella` on the search path |
| 3 | `cella.consent` on Lanterne | d-2026-012 passes, d-2026-011 fails |
| 4 | `cella.submit` and the log | numbered, chained, signed; the app role cannot write |
| 5 | One transaction from Node | commit keeps both, rollback neither, no gap |
| 6 | Checker on libpg_query | detects cross-feat reads, `now()`, `random()` |
| 7 | Composed `LANGUAGE sql` rule | two-thirds works in a graft and passes |
| 8 | PGlite | no: pgrx has no WASM target |
| 9 | Panic | a panic is a clean ERROR; an abort restarts all backends |

## 1 · Build

| Item | Value |
|---|---|
| Toolchain | nixpkgs `cargo-pgrx` 0.18.1, `postgresql_18` 18.6, rustc 1.98.1, clang 21 |
| Cold release build | 44.8 s wall (4 min 19 s CPU on 16 cores) |
| Incremental rebuild | 4.2 s |
| `cella.so` / `target/` | 2.0 MB / 560 MB |

Four things are specific to Nix, all handled in `env.sh` and `cluster.sh`:

- bindgen cannot find the libc headers. `BINDGEN_EXTRA_CLANG_ARGS` takes the
  clang wrapper's `libc-cflags` and `cc-cflags`, as nixpkgs' `bindgenHook`
  does.
- bindgen needs `rustfmt`.
- `pg_config` and the server headers come from separate outputs.
- The store is read-only, so `cargo pgrx install` fails. Instead,
  `cargo pgrx package` builds a tree that PG 18's new
  `extension_control_path` and `dynamic_library_path` load in place. On
  bacillus, `buildPgrxExtension` and `services.postgresql.extensions` take
  this role.

## 2 · Amount

`cella.amount` is a pgrx type of positive cents. It has `+`, comparisons, a
btree opclass, and casts from `bigint` and to `numeric`. Balances are plain
`numeric`.

`'0'::cella.amount` fails with `cella.amount must be positive, got 0 cents`.
The operators live in schema `cella`, so an unqualified `+` fails until
`cella` is on the search path. pgrx stores the type as serde CBOR, 14 bytes
against 8 for `bigint`.

## 3 · Consent

`cella.consent(member, stance ORDER BY at)` and `cella.tally(…)` share one
state, which keeps each member's latest stance.

```text
 d-2026-011 | consent | f | {"object": 1, "consent": 1, …}
 d-2026-012 | consent | t | {"object": 0, "consent": 8, …}
```

Hugo objected on 10-21 and consented on 10-23, so reversing the order fails
d-2026-012; a later consent from Malik passes d-2026-011. Votes are dated
by day, so same-day votes by one member would tie: the real ordering key is
the receipt number.

## 4 · The log

`cella.submit` is `SECURITY DEFINER` with a pinned `search_path`. Each call:

1. Locks `cella.head` with `FOR UPDATE`.
2. Hashes the entry with BLAKE3 (a domain-separated key, length-prefixed
   fields, the previous hash).
3. Signs the hash with Ed25519.

`PUBLIC` holds no rights on the log tables, and the app role may only read
`cella.log`:

```text
SET ROLE app;  SELECT cella.submit('decision.close', …)  → 1, then 2
INSERT INTO cella.log …   ERROR:  permission denied for table log
UPDATE cella.head …       ERROR:  permission denied for table head
(superuser edits entry 1) cella.verify_log() → ERROR:  log broken at 1: hash mismatch
```

The key is a fixed test seed. A superuser can rewrite the whole chain,
which the trust model accepts: the pilot trusts the host.

## 5 · One transaction

`node/txn.mjs` uses `pg` as the app role:

```text
COMMIT   verdict 3 present { log: 1, state: 1 }
ROLLBACK verdict 4 present { log: 0, state: 0 }
COMMIT   verdict 4 present { log: 1, state: 1 }
state write failed: cella.amount must be positive → present { log: 0, state: 0 }
contention: 8×250 submits (10% rolled back) in 842 ms → 2374/s; gaps 0
```

The head lock is held from `submit` until commit, so every ordered write in
the scope waits behind the slowest open transaction. A handler therefore
writes its state first and calls `submit` last, just before `COMMIT`.

## 6–7 · Schemas, rules, checker

`node/check.mjs` parses each `CREATE FUNCTION` with libpg_query 18 (npm
`libpg-query`), and parses a `$$` body as well. A feat sees its own schema
and `cella`; a graft also sees the feats it joins. The checker refuses:

- unqualified relations;
- calls outside the visible schemas;
- functions other than `cella.*` and the basic aggregates;
- SQL value functions such as `current_date`;
- unknown operators.

```text
ok      decision.consented          schemas [cella, decision]
REFUSED decision.two_thirds         - reads member.member: outside decision, cella
ok      decision_member.two_thirds  schemas [member, cella, decision]
REFUSED decision.overdue            - calls now(): not in the allow-list
REFUSED decision.lottery            - calls random() · reads the clock (current_date)
REFUSED invoice.billed_to           - reads client.client · unqualified relation billed
```

`decision_member.two_thirds` (3 × (for + consent) ≥ 2 × active members)
gives t, t, f, t for d-2026-006, 007, 011 and 012.

`BEGIN ATOMIC` bodies also record their dependencies in `pg_depend`, so the
catalog shows cross-schema reads too. Neither check is enough alone:

- `pg_depend` misses `$$` bodies and pinned built-ins such as `now()`.
- The parser misses casts and resolved operators (`::numeric` calls
  `cella.to_numeric`).

Rules should use `BEGIN ATOMIC` and pass both checks.

## 8 · PGlite

PGlite's extensions are Emscripten side modules, built inside its C build
tree and shipped as `.tar.gz` bundles, and its docs cover only C. pgrx has
no `wasm32-unknown-emscripten` target: its bindings, `sigsetjmp` panic
guards and SPI layer all assume a native backend. The one Rust precedent,
pg_trickle, moves its logic into a crate without pgrx and calls it through
a C shim, giving up features on the way.

The route for cella is a rules crate without pgrx. pgrx wraps it for the
server, and a WASM build serves devices and auditors, as option A planned.
We did not try a build, because this evidence already settles the question.

## 9 · Crash risk

| Failure | What happens |
|---|---|
| Rust `panic!` | pgrx raises an `ERROR`: the transaction aborts, the backend (same pid) lives, the head is unchanged |
| `abort()`, segfault, stack overflow | signal 6 kills the backend. The postmaster ends every other backend (a bystander's transaction rolls back), replays WAL and is ready again in 0.2 s; the log still verifies (1804 entries) |

A hard crash loses nothing that was committed, but it drops every connection
in the scope. Mitigations: no `unsafe`, no C dependencies beyond pgrx,
`panic = "unwind"`, and fuzzing of `submit`'s inputs.

## Risks

| Risk | Detail |
|---|---|
| Install rights | untrusted extension, superuser install: no managed Postgres |
| Upgrades | pgrx pinned exactly; a pgrx release per Postgres major; hand-written update scripts |
| Key in backend memory | production reads it from a superuser-only file |
| Throughput | one head row: about 2.4k ordered writes/s on a laptop |

## What would change the verdict

- The pilot must run on managed Postgres → option A.
- One rules binary must run inside PGlite → option A's WASM crate.
- A crash that drops every connection is unacceptable, or the trust review
  refuses a key held in backend memory → option B.
