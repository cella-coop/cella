// A throwaway Postgres cluster, as a new host runs a scope: a directory and
// a socket of its own, the extension the dev cluster loads, and key files
// at paths of its own, which a rehearsal fills or leaves for a restore to
// write. It never touches the dev cluster, and goes when stopped.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'

const repo = new URL('../../../../', import.meta.url).pathname

// What loads the extension, as `cella db start` wrote it for the dev cluster.
const loads = () =>
  readFileSync(join(repo, '.data/pg/cella.conf'), 'utf8')
    .split('\n')
    .filter((l) => /^(extension_control_path|dynamic_library_path|shared_preload_libraries) /.test(l))

export interface Cluster {
  dir: string
  // Where the cluster reads the notary's and the vault's key files.
  keys: { notary: string; vault: string }
  client: (db: string, user?: string) => Promise<pg.Client>
  url: (db: string) => string
  // Sets a server setting, or resets it with null, and reloads.
  set: (name: string, value: string | null) => Promise<void>
  stop: () => void
}

export async function cluster(): Promise<Cluster> {
  const dir = mkdtempSync(join(tmpdir(), 'cella-host-'))
  const keys = { notary: join(dir, 'keys/notary.key'), vault: join(dir, 'keys/vault.key') }
  mkdirSync(join(dir, 'keys'), { mode: 0o700 })
  const data = join(dir, 'pg')
  execFileSync('initdb', ['-D', data, '-U', 'postgres', '--auth=trust'], { stdio: 'ignore' })
  const conf = [
    "listen_addresses = ''",
    `unix_socket_directories = '${dir}'`,
    'port = 5432',
    ...loads(),
    `cella.key_file = '${keys.notary}'`,
    `cella.vault_key_file = '${keys.vault}'`,
    '',
  ]
  writeFileSync(join(data, 'postgresql.conf'), conf.join('\n'), { flag: 'a' })
  execFileSync('pg_ctl', ['-D', data, '-l', join(dir, 'pg.log'), '-w', 'start'], { stdio: 'ignore' })
  const client = async (db: string, user = 'postgres') => {
    const c = new pg.Client({ host: dir, port: 5432, user, database: db })
    await c.connect()
    return c
  }
  return {
    dir,
    keys,
    client,
    url: (db) => `postgresql:///${db}?host=${encodeURIComponent(dir)}&port=5432&user=postgres`,
    set: async (name, value) => {
      const c = await client('postgres')
      await c.query(value === null ? `ALTER SYSTEM RESET ${name}` : `ALTER SYSTEM SET ${name} = '${value.replace(/'/g, "''")}'`)
      await c.query('SELECT pg_reload_conf()')
      await c.end()
      // A reload reaches the new connections a test opens next.
      await new Promise((r) => setTimeout(r, 200))
    },
    stop: () => {
      execFileSync('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'ignore' })
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

// Runs this cella, as a host runs it, and returns what it printed.
export function cella(args: string[], env: Record<string, string> = {}): string {
  const bin = process.env.CELLA_BIN
  if (!bin) {
    throw new Error('CELLA_BIN is not set: run the scenario through `cella test e2e`')
  }
  return execFileSync(bin, args, { cwd: repo, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// The roles a scope's grants name, as its first migration makes them.
export const roles = `
  CREATE ROLE cella_app LOGIN;
  CREATE ROLE cella_rules NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;`
