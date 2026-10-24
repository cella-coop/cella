+++
title = "Notary"
updated = 2026-10-24
+++

The `cella` Postgres extension (pgrx, Postgres 18): the notary and the rule primitives as SQL, in schema `cella`. Every item is a thin wrapper over `cella-rules` (`core/rules/rs`) with no logic of its own, and the whole SQL surface is declared in one file, `rs/src/surface.rs`, whose header lists it; `rs/src/notary.rs` is the SPI plumbing `submit` and `verify_log` need.

## Surface

| SQL | What |
|---|---|
| `cella.amount` | positive cents, with `=`, `<>`, `<`, `<=`, `>`, `>=`, `+`, a btree class, casts from `bigint` and to `numeric` |
| `cella.amount(bigint)`, `cella.cents(amount)`, `cella.allocate(amount, bigint[])` | construct, unwrap, split exactly by weights |
| `cella.consent(member, stance, receipt)`, `cella.majority(…)` | aggregates; each member's highest-receipt stance counts, so they take no `ORDER BY` |
| `cella.verdict_date()` | the transaction's verdict date, fixed at first use and recorded by `submit` |
| `cella.receipt()` | the next receipt number, from a sequence; a rolled-back write leaves a gap here, never in the log |
| `cella.submit(op, payload, actor)` | runs the op's rules, appends a numbered, signed entry; returns `(verdict, state, reason)` |
| `cella.verify_log()` | rechecks the chain, every signature and the head |
| `cella.notary_key()` | the scope's public key |
| `cella.head`, `cella.log`, `cella.rule`, `cella.rule_text`, `cella.receipt_seq` | the log, its head row and the rule registry |

## Submit

A handler opens a transaction, writes its state, calls `cella.submit` last and commits. `submit` locks the head row, then runs every rule registered for the op in `cella.rule (op, fn regprocedure, owner)`, ordered by owner. A rule is a `STABLE` function `(payload jsonb) → text` that sees the transaction's own writes and returns `NULL` to accept or a reason to refuse; a volatile rule or one of another shape is an error.

On a refusal `submit` raises SQLSTATE `09000` (`triggered_action_exception`) with the rule's reason as the message, so the transaction cannot commit: the state and the verdict roll back together and the verdict number is not used. Feats' triggers raise the same code, so a handler maps `09000` to `Refused`. The rows `submit` returns are therefore always `settled`.

Each entry holds its number, op, actor, verdict date, a BLAKE3 digest of the canonical payload (never the payload), and each deciding rule's owner, signature and text digest; the text itself goes to `cella.rule_text`. Entries are hashed over the previous hash and signed with Ed25519.

The log tables are readable by everyone and writable by no role but the extension's owner; `submit`, `receipt`, `verify_log` and `notary_key` are `SECURITY DEFINER` with a pinned `search_path`. Only `cella_app` may execute `submit` and `receipt`.

## The rules role

Rules never run with the owner's rights. `submit` runs each rule as `cella_rules`, a role that cannot log in, is no superuser, bypasses no row security and owns nothing; each feat and graft grants it `USAGE` and `SELECT` on its own schema, and nothing more. `SET ROLE` is refused inside a security-definer function, so `submit` switches the way Postgres itself does for one: it sets the user id to `cella_rules` in a security-restricted operation around each rule call (`SetUserIdAndSecContext`) and restores it on return, on unwind and, through the transaction's abort, on any error. A rule therefore cannot write a table, take a receipt, call `submit`, read `cella.key_file` or the key file itself; `submit` refuses a rule declared `SECURITY DEFINER`, and the role is refused if it is a superuser or bypasses row security.

## Settings

- `cella.key_file` (`postgresql.conf` only): a file holding the scope's 32-byte Ed25519 seed. `just db` generates a dev key in `.data/notary.key`; it is never committed.
- `cella.clock` (superuser only): a fixed verdict date, `YYYY-MM-DD`, for fixtures and tests. Unset, the date is the clock's, in UTC, read once per transaction.

The library is loaded through `shared_preload_libraries` so its settings exist before any session sets them.

## Build

`just ext` packages it with `cargo pgrx package` into `.data/ext`; Postgres 18's `extension_control_path` and `dynamic_library_path` load it there, since the Nix store is read-only. The devshell provides cargo-pgrx, `pg_config`, the server headers and bindgen's libclang flags, so `cargo check --workspace` builds it too.

`sql/001-cella.sql` creates the extension and the app's role, `cella_app`; `sql/002-rules-role.sql` creates `cella_rules` and keeps `submit` and `receipt` to the app.
