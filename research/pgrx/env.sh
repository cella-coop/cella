#!/usr/bin/env bash
# Run a command inside the spike's toolchain: Postgres 18, cargo-pgrx 0.18.1, Rust, libclang, Node.
# Usage: ./env.sh <command...>
set -euo pipefail
clang=$(nix eval --raw nixpkgs#clang)
# Nix-specific: bindgen's libclang has no libc headers on its search path; borrow the
# wrapper's flags, which is what nixpkgs' rustPlatform.bindgenHook does.
exec nix shell \
  nixpkgs#postgresql_18 nixpkgs#postgresql_18.pg_config nixpkgs#postgresql_18.dev \
  nixpkgs#cargo-pgrx nixpkgs#cargo nixpkgs#rustc nixpkgs#clippy nixpkgs#rustfmt nixpkgs#clang nixpkgs#llvmPackages.libclang.lib \
  nixpkgs#pkg-config nixpkgs#nodejs nixpkgs#pnpm \
  -c env \
    PGRX_HOME="${PGRX_HOME:-$HOME/.claude/jobs/83da3889/tmp/pgrx-home}" \
    LIBCLANG_PATH="$(nix eval --raw nixpkgs#llvmPackages.libclang.lib)/lib" \
    BINDGEN_EXTRA_CLANG_ARGS="$(cat "$clang/nix-support/libc-cflags") $(cat "$clang/nix-support/cc-cflags")" \
    "$@"
