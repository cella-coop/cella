#!/usr/bin/env bash
# A user-owned, throwaway Postgres 18 cluster for the spike. Run inside ./env.sh.
# Usage: cluster.sh up | down | psql [args]
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
scratch=${SPIKE_SCRATCH:-$HOME/.claude/jobs/83da3889/tmp}
data=$scratch/pgdata
port=${PGPORT:-54318}
pkg=$(echo "$here"/ext/target/release/cella-pg18/nix/store/*-postgresql-18*)
case "${1:-}" in
  up)
    if [ ! -d "$data" ]; then
      initdb -D "$data" -U postgres --auth=trust >/dev/null
      cat >> "$data/postgresql.conf" <<CONF
port = $port
listen_addresses = '127.0.0.1'
unix_socket_directories = '$scratch'
# PG 18: extensions outside the read-only nix store share/ and lib/
extension_control_path = '\$system:$pkg/share/postgresql'
dynamic_library_path = '\$libdir:$pkg/lib'
CONF
    fi
    pg_ctl -D "$data" status >/dev/null || pg_ctl -D "$data" -l "$scratch/pg.log" -w start ;;
  down)
    pg_ctl -D "$data" -m fast stop ;;
  psql)
    shift; exec psql -h 127.0.0.1 -p "$port" -U postgres -X "$@" ;;
  *) echo "usage: $0 up|down|psql" >&2; exit 2 ;;
esac
