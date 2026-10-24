#!/usr/bin/env bash
# The whole spike end to end: build, a throwaway cluster, every check, then stop.
# Usage: ./run.sh   (outputs land in $SPIKE_SCRATCH/out/)
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
cd "$here"
export SPIKE_SCRATCH=${SPIKE_SCRATCH:-$HOME/.claude/jobs/83da3889/tmp}
out=$SPIKE_SCRATCH/out
mkdir -p "$out"
./env.sh bash -c '
  set -u
  out=$1
  (cd ext && cargo pgrx package --pg-config "$(which pg_config)" 2>&1 | tail -1)
  (cd node && pnpm install --silent)
  ./cluster.sh up
  ./cluster.sh psql -q -c "DROP DATABASE IF EXISTS spike" -c "CREATE DATABASE spike"
  ./cluster.sh psql -d spike -f sql/01-amount.sql > "$out/01-amount.txt" 2>&1
  ./cluster.sh psql -d spike -q -f sql/02-schemas.sql 2>/dev/null
  node node/load.mjs
  ./cluster.sh psql -d spike -f sql/03-consent.sql > "$out/03-consent.txt" 2>&1
  ./cluster.sh psql -d spike -f sql/04-notary.sql > "$out/04-notary.txt" 2>&1
  FORCE_COLOR=0 node node/txn.mjs > "$out/05-txn.txt" 2>&1
  node node/check.mjs sql/rules/*.sql > "$out/06-check.txt" 2>&1
  ./cluster.sh psql -d spike -f sql/05-rules.sql > "$out/07-rules.txt" 2>&1
  ./cluster.sh psql -d spike -f sql/06-panic.sql > "$out/09-panic.txt" 2>&1
  ./cluster.sh down
' _ "$out"
ls "$out"
