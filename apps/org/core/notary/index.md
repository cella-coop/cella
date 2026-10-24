+++
title = "Notary"
updated = 2026-10-24
+++

The `cella` Postgres extension (pgrx, Postgres 18): the notary and the rule primitives as SQL, in schema `cella`. Every item is a thin wrapper over `cella-rules` (`core/rules/rs`) with no logic of its own, and the whole SQL surface is declared in one file, `rs/src/surface.rs`, whose header lists it; `rs/src/notary.rs` is the SPI plumbing `submit` and `verify_log` need.

The notary is the scope's office for every write, and a layer under every feat rather than a feat: it holds no collection and has no writes of its own. It signs a receipt when a write arrives, runs the rules that attach to it, then signs a numbered verdict; it never decides an outcome, which is computed from the signed votes and can be computed again by anyone holding the log. Moving a scope's notary is moving its database to another host, a rung-6 concern ([ratchet](../../../../_corpus/doc/ratchet.md#moving-a-notary)); peers, other scopes' notaries, arrive with federation at rung 5.

## Surface

| SQL | What |
|---|---|
| `cella.amount` | positive cents, with `=`, `<>`, `<`, `<=`, `>`, `>=`, `+`, a btree class, casts from `bigint` and to `numeric` |
| `cella.amount(bigint)`, `cella.cents(amount)`, `cella.allocate(amount, bigint[])` | construct, unwrap, split exactly by weights |
| `cella.digest(text)`, `cella.digest(bytea)` | the plain BLAKE3 of the text's UTF-8 bytes or of the bytes, as `b3sum` computes it; immutable, so a generated column may hold it |
| `cella.document_canonical(bytea)`, `cella.document_hash(bytea)`, `cella.document_text(bytea)` | a Loro snapshot's canonical JSON, its BLAKE3 and its plain text (`cella_rules::document`); immutable, so a document version's generated columns hold them; a snapshot with no canonical form raises SQLSTATE `22000` |
| `cella.consent(member, stance, receipt)`, `cella.majority(…)` | aggregates; each member's highest-receipt stance counts, so they take no `ORDER BY` |
| `cella.verdict_date()` | the transaction's verdict date, fixed at first use and recorded by `submit` |
| `cella.receipt()` | the transaction's receipt number: one write, one receipt, taken at first use from a sequence; a rolled-back write leaves a gap here, never in the log |
| `cella.submit(op, payload, actor, signed)` | checks the member's signature, the device and the nonce, runs the op's rules, signs the receipt and appends a numbered, signed entry; returns `(verdict, state, reason)` |
| `cella.op()`, `cella.actor()`, `cella.device()` | the write `submit` is judging, for rules to read; NULL outside it |
| `cella.verify_log()` | rechecks the chain, every receipt, every signature, the member's and the notary's, and the head |
| `cella.notary_key()` | the scope's public key |
| `cella.head`, `cella.log`, `cella.receipt`, `cella.receipt_seq` | the log, its head row and its signed receipts |
| `cella.rule`, `cella.rule_text`, `cella.keyring`, `cella.power` | the registries: rules per op and their texts, the keyring, the power each op needs |

## Submit

A handler opens a transaction, writes its state, calls `cella.submit` last and commits. `signed` is `{ request, device, nonce, sig }`, bytes in hex: what the member asked for and their device's signature on it ([signatures](../../../../_corpus/doc/signatures.md)). `submit`:

1. checks the signature over the scope (`cella.scope`), the op, the actor, the device, the request's digest and the nonce;
2. locks the head row;
3. asks the keyring, the one function registered in `cella.keyring` (the `key` feat's), whether the device is a current key of the actor;
4. refuses a nonce a receipt of the same device already holds;
5. runs every rule registered for the op in `cella.rule (op, fn regprocedure, owner)`, ordered by owner, with `cella.op()`, `cella.actor()` and `cella.device()` set;
6. signs the receipt and appends the entry naming it.

A rule is a `STABLE` function `(payload jsonb) → text` that sees the transaction's own writes and returns `NULL` to accept or a reason to refuse; a volatile rule or one of another shape is an error. The keyring is a `STABLE` function `(actor text, device bytea) → text` of the same kind. Both run as `cella_rules`.

On a refusal, at any step, `submit` raises SQLSTATE `09000` (`triggered_action_exception`) with the reason as the message, so the transaction cannot commit: the state and the verdict roll back together, the verdict number is not used and the nonce is not spent. Feats' triggers raise the same code, so a handler maps `09000` to `Refused`. The rows `submit` returns are therefore always `settled`.

Each receipt holds its number, the op, the actor, the device, the nonce, the request's digest, the member's signature, the payload's digest and the time it arrived, hashed with BLAKE3 and signed. Each entry holds its number, op, actor, verdict date, the payload's digest (never the payload), its receipt's number and hash, and each deciding rule's owner, signature and text digest; the text itself goes to `cella.rule_text`. Entries are hashed over the previous hash and signed with Ed25519.

`cella.power (op, power, amount, owner)` names the power each op needs and the payload field holding its amount in cents, registered by the op's feat; the extension holds no rule over it: the `circle-member` graft attaches one to every op listed.

The log tables and the registries are readable by everyone and writable by no role but the extension's owner and the migrations; `submit`, `receipt`, `verify_log` and `notary_key` are `SECURITY DEFINER` with a pinned `search_path`. Only `cella_app` may execute `submit` and `receipt`.

## The rules role

Rules never run with the owner's rights. `submit` runs each rule as `cella_rules`, a role that cannot log in, is no superuser, bypasses no row security and owns nothing; each feat and graft grants it `USAGE` and `SELECT` on its own schema, and nothing more. `SET ROLE` is refused inside a security-definer function, so `submit` switches the way Postgres itself does for one: it sets the user id to `cella_rules` in a security-restricted operation around each rule call (`SetUserIdAndSecContext`) and restores it on return, on unwind and, through the transaction's abort, on any error. The keyring runs the same way. A rule therefore cannot write a table, take a receipt, call `submit`, read `cella.key_file` or the key file itself; `submit` refuses a rule declared `SECURITY DEFINER`, and the role is refused if it is a superuser or bypasses row security.

## Settings

- `cella.key_file` (`postgresql.conf` only): a file holding the scope's 32-byte Ed25519 seed. `cella db start` generates a dev key in `.data/notary.key`; it is never committed.
- `cella.clock` (superuser only): a fixed verdict date, `YYYY-MM-DD`, for fixtures and tests. Unset, the date is the clock's, in UTC, read once per transaction.
- `cella.scope` (superuser only): the scope's address, such as `lanterne.example`, which every write signature names. Set in `postgresql.conf` or on the database; `cella seed` sets it on the database from the fixture's `scope.toml`, and beside it `cella.scope_name` and `cella.scope_legal_name`, the co-op's name and legal name, which the notary never reads and the shell calls the co-op by.

The library is loaded through `shared_preload_libraries` so its settings exist before any session sets them.

## Build

`cella ext build` packages it with `cargo pgrx package` into `.data/ext`; Postgres 18's `extension_control_path` and `dynamic_library_path` load it there, since the Nix store is read-only. The devshell provides cargo-pgrx, `pg_config`, the server headers and bindgen's libclang flags, so `cargo check --workspace` builds it too.

`sql/001-cella.sql` creates the extension and the app's role, `cella_app`; `sql/002-rules-role.sql` creates `cella_rules` and keeps `submit` and `receipt` to the app.
