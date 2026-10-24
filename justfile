default:
    @just --list

# Everything a commit must pass
check: feat-check types rust

# Refuse any dependency the feat tree does not allow
feat-check:
    node tools/feat-check.mjs

types:
    pnpm install --offline --silent
    tsc -p .

rust:
    cargo check --workspace
    cargo clippy --workspace --no-deps -- -D warnings -A clippy::pedantic
