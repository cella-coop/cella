+++
title = "Cella CLI"
updated = 2026-10-24
+++

`cella` is the org app's Rust root (`apps/org/rs`, package `cella-cli`) and the repository's one entry point: every development and production task runs through it. It orchestrates the tools where their logic lives — cargo, cargo-pgrx, the Postgres binaries, pnpm and the node tools in `tools/` — as subprocesses from the workspace root, which it finds by walking up from the working directory, or else where the binary was built, so it runs the same from any directory. Each step prints one line, `ok` with its time and a summary, or `FAIL` followed by the tool's whole output; the exit code is the failing tool's. `-v` streams every tool's output instead. A missing tool fails with exit code 127 and says to run inside `nix develop`.

## Commands

| Command | For | What |
|---|---|---|
| `cella check [--no-sql]` | development | what a commit must pass: the feat check (`tools/feat-check.mjs`, its SQL boundaries skipped with `--no-sql`), the fixture check, the type check of the server layers and tools (`tsc`), the shell check (`svelte-kit sync`, then `svelte-check --fail-on-warnings` over the shell and every slice's client layers), `cargo check` and clippy; no database |
| `cella check feats\|fixtures\|types\|shell\|rust` | development | one part alone |
| `cella serve [--port PORT]` | development | the shell's dev server, Vite on `http://localhost:5173` by default, against the dev database: starts the cluster if it is stopped, applies any new migration, says if the database is unseeded, then runs until stopped. It sets `CELLA_DEV=1`, dev mode, in which the server signs a write as the member picked in the user menu with their TEST-ONLY fixture key |
| `cella build` | production | builds the shell with adapter-node into `apps/org/ts/build`, a Node server (`node apps/org/ts/build`) that finds its database by the `PG*` variables or `DATABASE_URL` and listens on `PORT`; outside dev mode it signs for no one, so it reads and refuses every write. It expects TLS in front: adapter-node takes the origin to be https unless `PROTOCOL_HEADER` names a proxy's header |
| `cella db start` | development | builds the extension, then starts the dev cluster or restarts it to load a rebuilt one; creates the cluster, its dev key `.data/notary.key` and the database on first use |
| `cella db stop`, `cella db status` | development | stops the cluster; says whether it runs, exiting 3 when stopped as `pg_ctl` does |
| `cella db reset [--db NAME] [--seed FIXTURE]` | development | drops, recreates and migrates a database on the cluster, the dev one by default, and with `--seed` loads a mock co-op into it, such as `lanterne`; a reset never leaves a database unmigrated |
| `cella db psql [ARGS…]` | development | psql on the dev database; arguments pass through |
| `cella ext build` | development | packages the `cella` extension with `cargo pgrx package` into `.data/ext`, where the dev cluster loads it |
| `cella migrate [--url URL]` | both | applies the migrations cascading down the feat tree (`tools/migrate.mjs`), on the dev database or on any database by URL |
| `cella seed <fixture> [--url URL]` | development | loads a mock co-op from `apps/org/fixtures/`, such as `lanterne` (`tools/seed.mjs`) |
| `cella test` | development | the rule primitives' tests, this CLI's tests, the node tools' tests (`tools/_tests`), then the slice tests and the e2e scenarios; needs the dev cluster |
| `cella test slice [NAME]` | development | the slice tests, each feat's or graft's `_tests/*.test.ts`, or one slice's by its name, such as `transaction`: for each slice, `cella_test` is renewed and migrated with the app's core and that slice's part of the tree alone, unseeded |
| `cella test e2e [NAME]` | development | the scenarios across slices, `apps/org/ts/_e2e/*.test.ts`, or one by its file name, such as `admission`: the shell is built first (`cella build`), since `shell` drives its server; then for each, `cella_test` is renewed, migrated whole and seeded with Lanterne |
| `cella test rules\|cli\|tools` | development | one part alone |
| `cella log verify [--url URL]` | both | runs `cella.verify_log()`, which checks every entry, the receipt it names and both signatures on it, the member's and the notary's, and prints the log's head and the scope's public key; a broken log fails, with the notary's warnings saying where |
| `cella key init <PATH>` | production | writes a new scope signing key, the 32-byte Ed25519 seed `cella.key_file` reads, readable by its owner only and never over an existing file; prints its public key |

The dev cluster is Postgres 18 in `.data/pg`, owned by the user, listening on 127.0.0.1 at `CELLA_PGPORT` (54342) with trust authentication; the dev database is `CELLA_DB` (`cella`). Commands on it connect by the `PG*` variables. `--url` connects anywhere else instead and is handed to the node tools as `DATABASE_URL`; cella never reads `DATABASE_URL` from its own environment, so a production database is only ever named on the command line.

## On the path

The flake's `cella` package is a wrapper that runs this crate with `cargo run -q -p cella-cli`, carrying the toolchain and pgrx's settings, so `cella` is on the devshell's path, rebuilds itself after a change and is instant otherwise; `nix run .#cella -- check` runs it from a checkout without entering the shell.

## Tests

`tests/help.rs` walks the command tree and runs the built binary's `--help` for every command, checks clap's own consistency, that an unknown command exits 2, and that `key init` writes an owner-only 32-byte key and refuses to overwrite it. `src/test.rs` checks that a test file is placed by where it sits: a slice test in a feat's or graft's `_tests/`, an e2e scenario in an app root's `_e2e/`, and nothing elsewhere.

## Coming

- `cella serve --prod` — the built shell as a scope's server, once members' devices sign in the browser and the server has sessions.
- `cella deploy` — a scope's deployment.
