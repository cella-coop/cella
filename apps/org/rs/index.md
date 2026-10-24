+++
title = "Cella CLI"
updated = 2026-10-24
+++

`cella` is the org app's Rust root (`apps/org/rs`, package `cella-cli`) and the repository's one entry point: every development and production task runs through it. It orchestrates the tools where their logic lives — cargo, cargo-pgrx, the Postgres binaries, pnpm and the node tools in `tools/` — as subprocesses from the workspace root, which it finds by walking up from the working directory, or else where the binary was built, so it runs the same from any directory. Each step prints one line, `ok` with its time and a summary, or `FAIL` followed by the tool's whole output; the exit code is the failing tool's. `-v` streams every tool's output instead. A missing tool fails with exit code 127 and says to run inside `nix develop`.

## Commands

| Command | For | What |
|---|---|---|
| `cella check [--no-sql]` | development | what a commit must pass: the feat check (`tools/feat-check.mjs`, its SQL boundaries skipped with `--no-sql`), the fixture check, the type check, `cargo check` and clippy; no database |
| `cella check feats\|fixtures\|types\|rust` | development | one part alone |
| `cella db start` | development | builds the extension, then starts the dev cluster or restarts it to load a rebuilt one; creates the cluster, its dev key `.data/notary.key` and the database on first use |
| `cella db stop`, `cella db status` | development | stops the cluster; says whether it runs, exiting 3 when stopped as `pg_ctl` does |
| `cella db reset [--db NAME]` | development | drops and recreates a database on the cluster |
| `cella db psql [ARGS…]` | development | psql on the dev database; arguments pass through |
| `cella ext build` | development | packages the `cella` extension with `cargo pgrx package` into `.data/ext`, where the dev cluster loads it |
| `cella migrate [--url URL]` | both | applies the migrations cascading down the feat tree (`tools/migrate.mjs`), on the dev database or on any database by URL |
| `cella seed <fixture> [--url URL]` | development | loads a mock co-op from `apps/org/fixtures/`, such as `lanterne` (`tools/seed.mjs`) |
| `cella test` | development | the rule primitives' tests, this CLI's tests, the node tools' tests (`tools/_tests`), then each slice's test file on `cella_test`, reset, migrated and seeded with Lanterne first; needs the dev cluster |
| `cella test rules\|cli\|tools\|slice [NAME]` | development | one part alone, or one slice by its file name, such as `admission` |
| `cella log verify [--url URL]` | both | runs `cella.verify_log()`, which checks every entry, the receipt it names and both signatures on it, the member's and the notary's, and prints the log's head and the scope's public key; a broken log fails, with the notary's warnings saying where |
| `cella key init <PATH>` | production | writes a new scope signing key, the 32-byte Ed25519 seed `cella.key_file` reads, readable by its owner only and never over an existing file; prints its public key |

The dev cluster is Postgres 18 in `.data/pg`, owned by the user, listening on 127.0.0.1 at `CELLA_PGPORT` (54342) with trust authentication; the dev database is `CELLA_DB` (`cella`). Commands on it connect by the `PG*` variables. `--url` connects anywhere else instead and is handed to the node tools as `DATABASE_URL`; cella never reads `DATABASE_URL` from its own environment, so a production database is only ever named on the command line.

## On the path

The flake's `cella` package is a wrapper that runs this crate with `cargo run -q -p cella-cli`, carrying the toolchain and pgrx's settings, so `cella` is on the devshell's path, rebuilds itself after a change and is instant otherwise; `nix run .#cella -- check` runs it from a checkout without entering the shell.

## Tests

`tests/help.rs` walks the command tree and runs the built binary's `--help` for every command, checks clap's own consistency, that an unknown command exits 2, and that `key init` writes an owner-only 32-byte key and refuses to overwrite it.

## Coming

- `cella serve` — the org app's server, for development and production.
- `cella deploy` — a scope's deployment.
