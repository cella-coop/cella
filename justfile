default:
    @just --list

# Everything a commit must pass
check: feat-check fixture-check types rust

# Refuse any dependency the feat tree does not allow
feat-check:
    node tools/feat-check.mjs

# Mock co-ops balance and their links resolve
fixture-check:
    node tools/fixture-check.mjs

types:
    pnpm install --offline --silent
    tsc -p .

rust:
    cargo check --workspace
    cargo clippy --workspace --no-deps -- -D warnings -A clippy::pedantic
