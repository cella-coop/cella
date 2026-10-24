set dotenv-load := false

export PGHOST := "127.0.0.1"
export PGPORT := env("CELLA_PGPORT", "54342")
export PGUSER := "postgres"
export PGDATABASE := env("CELLA_DB", "cella")

data := justfile_directory() / ".data"

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

# Build the cella extension into .data/ext, where Postgres loads it in place
ext:
    cargo pgrx package -p cella --debug --pg-config "$PGRX_PG_CONFIG_PATH" --out-dir {{data}}/ext

# Start the dev Postgres 18 in .data/, restarting it on a rebuilt extension
db: ext
    #!/usr/bin/env bash
    set -euo pipefail
    pg={{data}}/pg
    pkg=$(echo {{data}}/ext/nix/store/*-postgresql-18*)
    if [ ! -d "$pg" ]; then
      initdb -D "$pg" -U postgres --auth=trust >/dev/null
      echo "include_if_exists = 'cella.conf'" >> "$pg/postgresql.conf"
    fi
    if [ ! -f {{data}}/notary.key ]; then
      (umask 077 && head -c 32 /dev/urandom > {{data}}/notary.key)
    fi
    # Rewritten each time: the paths follow the Nix store. PG 18 loads the
    # extension from outside the read-only store.
    cat > "$pg/cella.conf" <<CONF
    port = $PGPORT
    listen_addresses = '127.0.0.1'
    unix_socket_directories = '{{data}}'
    extension_control_path = '\$system:$pkg/share/postgresql'
    dynamic_library_path = '\$libdir:$pkg/lib'
    shared_preload_libraries = 'cella'
    cella.key_file = '{{data}}/notary.key'
    CONF
    if pg_ctl -D "$pg" status >/dev/null; then
      pg_ctl -D "$pg" -l {{data}}/pg.log -w restart >/dev/null
    else
      pg_ctl -D "$pg" -l {{data}}/pg.log -w start >/dev/null
    fi
    psql -X -q -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$PGDATABASE'" | grep -q 1 \
      || createdb "$PGDATABASE"
    echo "postgres 18 on 127.0.0.1:$PGPORT, database $PGDATABASE"

db-stop:
    pg_ctl -D {{data}}/pg -m fast stop

# Drop and recreate the database
reset:
    dropdb --if-exists --force "$PGDATABASE"
    createdb "$PGDATABASE"

