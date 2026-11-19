// The denial scenario, generated for every slice: on a seeded Lanterne,
// a person signed in who holds no mandate and is no member reads every
// table, view and row-returning definer function each feat and graft
// makes, and core's structure, and sees no row but those its slice declares
// shared and its registries; a member of the scope reads the structure
// whole. No slice opts in: the slices are read from the tree and
// their objects from the database, and a slice whose schema the database
// lacks, or a schema no slice owns, fails. What Lanterne leaves empty
// denies nothing, and is named unproven. Run by `cella test e2e denial`.
// covers: all

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const root = join(import.meta.dirname, '../..')

// Every slice that makes SQL, by its schema, with its SQL's directory: a
// feat's `core/sql/` and a graft's `sql/`, at every node of the tree, and
// a core graft's, `core/grafts/<graft>/sql/`.
function slices(): Map<string, { name: string; sql: string }> {
  const out = new Map<string, { name: string; sql: string }>()
  const node = (dir: string) => {
    for (const [kind, sql] of [['feats', 'core/sql'], ['grafts', 'sql'], ['core/grafts', 'sql']]) {
      const under = join(dir, kind)
      if (!existsSync(under)) continue
      for (const name of readdirSync(under).sort()) {
        if (existsSync(join(under, name, sql))) out.set(name.replaceAll('-', '_'), { name, sql: join(under, name, sql) })
        if (kind === 'feats') node(join(under, name))
      }
    }
  }
  node(root)
  return out
}

// A retired slice's migrations drop the schema they made, and leave it
// nothing to read.
const retired = (schema: string, sql: string) =>
  readdirSync(sql).some((f) => f.endsWith('.sql') && new RegExp(`DROP SCHEMA ${schema};`).test(readFileSync(join(sql, f), 'utf8')))

// The schemas no feat or graft owns: the notary's and the migrations',
// layers under every slice, and core's. The analytics port's is read as a
// slice's is, and so are core's circles and its register of policies, the
// coop's structure, which a member of the scope reads whole
// ([circle](../../core/circle/index.md#who-reads-the-structure)), and
// core's people, read by their owning circle as a slice's records are.
const LAYERS = new Set(['cella', 'vault', 'migration', 'public'])
const STRUCTURE = ['circle', 'policy']
const PEOPLE = 'person'
const PORT = 'analytics'

const nobody = 'nobody@denial.example'
const su = new pg.Client()
let reader: pg.Client

// Everything a schema holds that a reader may read rows of: its tables,
// shared where a policy that lets the app's role read is a registry or
// commented `shared: why`; its views, shared where their comment declares
// it, and reading as their reader or as their owner; and its definer
// functions that return rows, declared shared or keyed by their comment.
const OBJECTS = `
  SELECT 'table' AS kind, c.oid::regclass::text AS name, NULL AS comment,
         EXISTS (SELECT FROM pg_policy p
                 WHERE p.polrelid = c.oid AND p.polpermissive AND p.polcmd IN ('r', '*')
                   AND (p.polroles = '{0}' OR 'cella_app'::regrole = ANY (p.polroles))
                   AND (p.polname = 'registry' OR obj_description(p.oid, 'pg_policy') ~ '^shared: \\S')) AS shared,
         false AS invoker,
         has_table_privilege('cella_app', c.oid, 'SELECT') AS granted
  FROM pg_class c WHERE c.relnamespace = $1::regnamespace AND c.relkind IN ('r', 'p') AND NOT c.relispartition
  UNION ALL
  SELECT 'view', c.oid::regclass::text, obj_description(c.oid, 'pg_class'),
         coalesce(obj_description(c.oid, 'pg_class') ~ '^audience: shared', false),
         coalesce(c.reloptions && '{security_invoker=true,security_invoker=on}', false),
         has_table_privilege('cella_app', c.oid, 'SELECT')
  FROM pg_class c WHERE c.relnamespace = $1::regnamespace AND c.relkind IN ('v', 'm')
  UNION ALL
  SELECT 'function', p.oid::regprocedure::text, obj_description(p.oid, 'pg_proc'),
         coalesce(obj_description(p.oid, 'pg_proc') ~ '^audience: shared', false),
         false,
         has_function_privilege('cella_app', p.oid, 'EXECUTE')
  FROM pg_proc p WHERE p.pronamespace = $1::regnamespace AND p.prokind = 'f' AND p.prosecdef
    AND (p.proretset OR p.prorettype = 'record'::regtype OR p.prorettype IN (SELECT oid FROM pg_type WHERE typtype = 'c'))
  ORDER BY 1, 2`

type Read = { kind: 'table' | 'view' | 'function'; name: string; comment: string | null; shared: boolean; invoker: boolean; granted: boolean }

// What each view reads, a relation or a function, by name.
const READS = `
  SELECT DISTINCT r.ev_class::regclass::text AS view,
         CASE d.refclassid WHEN 'pg_class'::regclass THEN d.refobjid::regclass::text ELSE d.refobjid::regprocedure::text END AS reads
  FROM pg_rewrite r JOIN pg_depend d ON d.classid = 'pg_rewrite'::regclass AND d.objid = r.oid
  WHERE d.refclassid IN ('pg_class'::regclass, 'pg_proc'::regclass) AND d.refobjid <> r.ev_class`

// What `actor`, `nobody` unless named, reads of a table or a view, or of a
// function keyed by a secret they cannot hold, in a transaction rolled
// back; null where the app's role may not read it at all.
async function as(read: Read, actor = nobody): Promise<number | null> {
  await reader.query('BEGIN')
  try {
    await reader.query(`SELECT set_config('cella.actor', $1, true)`, [actor])
    if (read.kind !== 'function') return (await reader.query(`SELECT count(*)::int AS n FROM ${read.name}`)).rows[0].n
    const secret = read.name.endsWith('(bytea)') ? randomBytes(32) : randomBytes(32).toString('hex')
    return (await reader.query(`SELECT count(*)::int AS n FROM ${read.name.replace(/\(.*\)$/, '')}($1)`, [secret])).rows[0].n
  } catch (e: any) {
    if (e.code === '42501') return null
    throw new Error(`${read.name}: ${e.message}`)
  } finally {
    await reader.query('ROLLBACK')
  }
}

const whole = async (name: string): Promise<number> => (await su.query(`SELECT count(*)::int AS n FROM ${name}`)).rows[0].n

// Every object declared shared, a registry or a definer function, and
// what each view reads, to say which views read their reader's rows of
// what is declared: a view reading as its reader shows what its tables
// let its reader read, so it may show what any of them declares shared.
const declared = new Set<string>()
const reads = new Map<string, string[]>()
const shows = (name: string, seen = new Set<string>()): string | undefined => {
  if (seen.has(name)) return undefined
  seen.add(name)
  for (const r of reads.get(name) ?? []) {
    if (declared.has(r)) return r
    const through = shows(r, seen)
    if (through) return through
  }
}

before(async () => {
  await su.connect()
  reader = new pg.Client({ user: 'cella_app' })
  await reader.connect()
  const schemas: string[] = (await su.query(`SELECT nspname FROM pg_namespace WHERE nspname !~ '^(pg_|information_schema$)'`)).rows.map((r) => r.nspname)
  for (const schema of schemas) {
    const all: Read[] = (await su.query(OBJECTS, [schema])).rows
    for (const o of all) if (o.shared || (o.kind === 'function' && /^audience: keyed by /.test(o.comment ?? ''))) declared.add(o.name)
  }
  for (const { view, reads: r } of (await su.query(READS)).rows) reads.set(view, [...(reads.get(view) ?? []), r])
})

after(async () => {
  await reader.end()
  await su.end()
})

const tree = slices()

test('every feat and graft the tree holds owns a schema of the database, and every schema is a slice\'s, core\'s or a layer\'s', async () => {
  const schemas: string[] = (
    await su.query(`SELECT nspname FROM pg_namespace WHERE nspname !~ '^(pg_|information_schema$)' ORDER BY 1`)
  ).rows.map((r) => r.nspname)
  const missing = [...tree].filter(([s, { sql }]) => !schemas.includes(s) && !retired(s, sql)).map(([s]) => s)
  assert.deepEqual(missing, [], 'a slice makes SQL in no schema of its name, so its denial test reads nothing of it')
  const astray = schemas.filter((s) => !tree.has(s) && !LAYERS.has(s) && !STRUCTURE.includes(s) && s !== PORT && s !== PEOPLE)
  assert.deepEqual(astray, [], 'a schema no slice owns escapes the denial test')
})

for (const [schema, name] of [[PORT, PORT] as const, [PEOPLE, PEOPLE] as const, ...STRUCTURE.map((s) => [s, s] as const), ...[...tree].map(([s, { name }]) => [s, name] as const)]) {
  test(`${name} shows a person with no mandate nothing but what it declares shared`, async (t) => {
    const slice = tree.get(schema)
    if (slice && retired(schema, slice.sql)) return t.skip('retired: its migrations drop its schema')
    const leaks: string[] = []
    const unproven: string[] = []
    const shared: string[] = []
    for (const read of (await su.query(OBJECTS, [schema])).rows as Read[]) {
      if (!read.granted || read.shared) continue
      if (read.kind === 'function') {
        if (!/^audience: keyed by [a-z_]+: /.test(read.comment ?? '')) {
          leaks.push(`${read.name} runs as its owner and returns rows, declared neither shared nor keyed`)
          continue
        }
        const n = await as(read)
        if (n) leaks.push(`${read.name} returns ${n} rows for a secret no one holds`)
        continue
      }
      const all = await whole(read.name)
      const n = await as(read)
      const through = read.kind === 'view' && read.invoker ? shows(read.name) : undefined
      if (n && through) shared.push(`${read.name} through ${through}`)
      else if (n) leaks.push(`${read.name} shows ${n} of its ${all} rows`)
      else if (n === 0 && all === 0) unproven.push(read.name)
    }
    if (shared.length) t.diagnostic(`shared, a view reading as its reader of what is declared shared: ${shared.join(', ')}`)
    if (unproven.length) t.diagnostic(`unproven, Lanterne leaves them empty: ${unproven.join(', ')}`)
    assert.deepEqual(leaks, [], `${nobody}, signed in with no mandate, reads past ${name}'s policies`)
  })
}

// A member of the scope, who holds the member role seated in the
// assembly, reads the whole structure: every row of each table and view
// of core's circles and its register of policies.
test('a member of the scope reads every row of the structure', async () => {
  const member: string = (
    await su.query(
      `SELECT t.holder FROM circle.tenure t
       WHERE t.role = 'member' AND t.circle = circle.assembly() AND t.until IS NULL ORDER BY t.holder LIMIT 1`,
    )
  ).rows[0].holder
  const short: string[] = []
  for (const schema of STRUCTURE) {
    for (const read of (await su.query(OBJECTS, [schema])).rows as Read[]) {
      if (!read.granted || read.kind === 'function') continue
      const [all, n] = [await whole(read.name), await as(read, member)]
      if (n !== all) short.push(`${read.name} shows ${n} of its ${all} rows`)
    }
  }
  assert.deepEqual(short, [], `${member}, a member of the scope, reads short of the structure`)
})
