default:
    @just --list

# Everything a commit must pass
check: feat-check fixture-check types rust

install:
    pnpm install --offline --silent

# Refuse any dependency the feat tree does not allow
feat-check:
    node tools/feat-check.mjs

# Mock co-ops balance and their links resolve
fixture-check: install
    node tools/fixture-check.mjs

types: install
    tsc -p .

rust:
    cargo check --workspace
    cargo clippy --workspace --no-deps -- -D warnings -A clippy::pedantic
