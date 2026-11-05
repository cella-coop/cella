// The founding, end to end on a fresh scope beside the seeded Lanterne: a
// database migrated and empty, as a new co-op's is, founded as a SCOP SARL
// in France by three founders, as the log's first entry. A founding with
// no procedure for its root, one naming no founding motion, one whose
// motion a founder gave no stance on and one with a founder seated
// nowhere are refused first, each saying which and leaving the log
// empty; the founding settles, its founders seated in the assembly with a vote
// and every default of the form taken; a founder's next write passes the
// guards its policies set; and a second founding is refused. Run by
// `cella test e2e founding`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { profile } from '@cella/org-person/api'
import { fixture, signer } from '@cella/org-sign'
import { found } from '@cella/org-graft-membership-motion/api'
import type { Deps } from '@cella/org-db'
import { cella } from './cluster.ts'
import { folded, tables, unfold } from './fold.ts'

const name = `${process.env.PGDATABASE ?? 'cella'}_founding`
const scope = { address: 'atelier.example', name: 'Atelier', legal_name: 'Atelier SCOP SARL', legal_form: 'scop-sarl-fr', timezone: 'Europe/Paris' }
const founders = [
  { address: 'ines@atelier.example', name: 'Inès Laurent', label: 'laptop' },
  { address: 'theo@atelier.example', name: 'Théo Garnier', label: 'laptop' },
  { address: 'mina@atelier.example', name: 'Mina Haddad', label: 'phone' },
]
const ines = founders[0]
const day = '2026-10-01'

// The seed's founding, from a fixture built from the form's defaults.
const tools = new URL('../../../../tools/seed/', import.meta.url).href
const { seed } = (await import(`${tools}found.mjs`)) as {
  seed: (db: pg.Client, read: (file: string) => unknown, at: { from: string }) => Promise<{ outcome: { state: string; entry?: number; reason?: string } }>
}
const { founding } = (await import(`${tools}founding.mjs`)) as {
  founding: (db: pg.Client, of: Record<string, unknown>) => Promise<(file: string) => unknown>
}

let su: pg.Client
let app: pg.Client
const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const as = (db: pg.Client, f = ines): Deps => ({ db, actor: f.address, sign: signer(scope.address, f.address, fixture(f.address, f.label)) })

before(async () => {
  cella(['db', 'reset', '--db', name])
  su = new pg.Client({ database: name })
  await su.connect()
})

after(async () => {
  await app?.end()
  await su.end()
  const drop = new pg.Client()
  await drop.connect()
  await drop.query(`DROP DATABASE IF EXISTS ${drop.escapeIdentifier(name)} WITH (FORCE)`)
  await drop.end()
})

test('a founding with no procedure for its root is refused, and leaves the log empty', async () => {
  assert.equal(await head(), 0)
  const read = await founding(su, { scope, founders, day, keep: (d: { kind: string }) => d.kind !== 'procedure' })
  const { outcome } = await seed(su, read, { from: 'no procedure' })
  assert.equal(outcome.state, 'refused')
  assert.match(outcome.reason ?? '', /ag decides by consent, which no policy in force there makes: a co-op is founded with the procedure its root decides by/)
  assert.equal(await head(), 0)
  assert.equal(Number((await one<{ n: string }>('SELECT count(*) AS n FROM person.person')).n), 0)
})

// A founding of the fixture `read` reads, with one file changed by `change`.
const altered = (read: (file: string) => unknown, file: string, change: (v: unknown) => unknown) => (f: string) =>
  f === file ? change(read(f)) : read(f)
const mina = founders[2]

for (const [what, file, change, reason] of [
  [
    'naming no founding motion',
    'scope',
    (s: Record<string, unknown>) => ({ ...s, founding: undefined }),
    /the founding names no founding motion: it names the motion of ag that adopted the form's defaults/,
  ],
  [
    'whose motion a founder gave no stance on',
    'motion',
    ({ motion }: { motion: { vote: { member: string }[] }[] }) => ({
      motion: motion.map((d) => ({ ...d, vote: d.vote.filter((v) => v.member !== mina.address) })),
    }),
    /1 of the 3 founders gave no stance on m-2026-001: its founders decide their founding motion, each with a stance before it closes/,
  ],
  [
    'with a founder seated nowhere',
    'circle',
    (c: { member: { person: string }[] }) => ({ ...c, member: c.member.filter((m) => m.person !== mina.address) }),
    /1 of the 3 founders, the members whose membership began by 2026-10-01, had no seat with a vote in ag that day: seat every founder in the root, in a role that votes by consent/,
  ],
] as const) {
  test(`a founding ${what} is refused, saying so, and leaves the log empty`, async () => {
    const read = altered(await founding(su, { scope, founders, day }), file, change as (v: unknown) => unknown)
    const { outcome } = await seed(su, read, { from: what })
    assert.equal(outcome.state, 'refused')
    assert.match(outcome.reason ?? '', reason)
    assert.doesNotMatch(outcome.reason ?? '', /@atelier\.example/)
    assert.equal(await head(), 0)
    assert.equal(Number((await one<{ n: string }>('SELECT count(*) AS n FROM person.person')).n), 0)
  })
}

test('a fresh scope is founded as a SCOP SARL in France by three founders, as the log\'s first entry', async () => {
  const { outcome } = await seed(su, await founding(su, { scope, founders, day }), { from: 'atelier' })
  assert.equal(outcome.state, 'settled', outcome.reason)
  assert.equal(outcome.entry, 1)
  const first = await one<{ op: string; actor: string; form: string; motion: string }>(
    `SELECT op, actor, cella.opened(1) ->> 'form' AS form, cella.opened(1) ->> 'motion' AS motion FROM cella.log WHERE n = 1`,
  )
  assert.deepEqual(first, { op: 'membership-motion:scope:found', actor: ines.address, form: 'scop-sarl-fr', motion: 'm-2026-001' })
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)

  // Each founder sits in the assembly with a vote, as an active member
  // with a device, and gave the founding motion a stance.
  for (const f of founders) {
    const sat = await one<{ sits: boolean; devices: string }>(
      `SELECT membership.sits_in($1, 'ag', cella.verdict_date()) AS sits,
              (SELECT count(*) FROM person.device d WHERE d.address = $1 AND d.revoked IS NULL) AS devices`,
      [f.address],
    )
    assert.deepEqual(sat, { sits: true, devices: '1' }, f.address)
  }
  const founded = await su.query<{ member: string; seated: boolean; decided: boolean }>(
    `SELECT member, seated, decided FROM membership_motion.founders('m-2026-001') ORDER BY member`,
  )
  assert.equal(founded.rows.length, 3)
  for (const f of founded.rows) {
    assert.deepEqual({ seated: f.seated, decided: f.decided }, { seated: true, decided: true }, f.member)
  }
  // The root decides by consent, a policy of its founding motion makes it,
  // and every default of the form is taken.
  const root = await one<{ procedure: string; policy: string }>(
    `SELECT c.procedure, p.policy FROM circle.circle c JOIN motion.procedure p ON p.id = c.procedure WHERE c.assembly`,
  )
  assert.deepEqual(root, { procedure: 'consent', policy: 'm-2026-001/1' })
  const standing = await su.query<{ standing: string; n: string }>(
    `SELECT standing, count(*) AS n FROM policy.standing('ag', cella.verdict_date()) GROUP BY standing`,
  )
  const defaults = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM policy.default WHERE form = 'scop-sarl-fr'`)).n)
  assert.deepEqual(standing.rows, [{ standing: 'taken', n: String(defaults) }])
})

test('a founder\'s next write passes the guards the founding\'s policies set', async () => {
  app = new pg.Client({ user: 'cella_app', database: name })
  await app.connect()
  const kept = await profile({ person: ines.address, email: 'ines@laurent.example' }, as(app))
  assert.equal(kept.state, 'settled', (kept as { reason?: string }).reason)
  assert.equal(await head(), 2)
  // Keeping another's profile is no one's right.
  const other = await profile({ person: founders[1].address, email: 'theo@forged.example' }, as(app))
  assert.equal(other.state, 'refused')
})

test('a second founding is refused', async () => {
  const again = await found({ form: 'scop-sarl-fr', motion: 'm-2026-001', from: 'again', load: async () => ({}) }, as(su))
  assert.equal(again.state, 'refused')
  assert.match((again as { reason: string }).reason, /a co-op is founded once, as its log's first entry; the log holds 2 already/)
  assert.equal(await head(), 2)
})

test('the founding and the profile after it fold into a fresh database that matches it, every table of every slice', async () => {
  try {
    assert.match(folded(name), /matches .* row for row/)
    const [source, fold] = [await tables(name), await tables(`${name}_fold`)]
    for (const t of ['circle.circle', 'motion.vote', 'person.device', 'person.person', 'policy.policy']) {
      assert.ok(source[t], `${t} holds the founding's rows`)
    }
    assert.deepEqual(fold, source)
  } finally {
    await unfold(name)
  }
})
