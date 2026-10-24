#!/usr/bin/env bash
# Runs every candidate over the same facts and cases, then compares each
# output line with the TypeScript reference. Needs: nix develop ../.. for
# node/cargo; CEDAR (built with --features analyze), CVC5, SOUFFLE (64-bit
# domain), and SCRATCH for build dirs.
set -euo pipefail
cd "$(dirname "$0")"
: "${SCRATCH:=/tmp/rules-spike}"
export SCRATCH
node facts/convert.mjs
node ts/run.ts > ts/output.txt
CARGO_TARGET_DIR=$SCRATCH/rust-target cargo run -q --manifest-path rust/Cargo.toml > rust/output.txt
CARGO_TARGET_DIR=$SCRATCH/cel-target cargo run -q --manifest-path cel/Cargo.toml > cel/output.txt
node cel/run.mjs > cel/output.js.txt
node cedar/run.mjs > cedar/output.txt
cedar/analyse.sh > cedar/analysis.txt
node datalog/run.mjs > datalog/output.txt
for f in rust/output.txt cel/output.txt cel/output.js.txt cedar/output.txt datalog/output.txt; do
  ref=ts/output.txt
  if [ "$f" = cedar/output.txt ]; then
    # Cedar checks a split but cannot compute it: compare verdicts only
    ref=$(mktemp)
    sed -E 's/ work=[0-9]+ reserves=[0-9]+ interest=[0-9]+//' ts/output.txt > "$ref"
  fi
  echo "$f: $(comm -12 "$f" "$ref" | wc -l) agree, $(comm -23 "$f" "$ref" | wc -l) differ, $(comm -13 "$f" "$ref" | wc -l) not expressed"
done
