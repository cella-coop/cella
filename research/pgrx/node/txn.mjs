// One transaction from the app role: the verdict and its state change commit or roll back together.
import pg from 'pg'

const cfg = { host: '127.0.0.1', port: 54318, user: 'app', database: 'spike' }
const db = new pg.Client(cfg)
await db.connect()

const head = async () => (await db.query('SELECT coalesce(max(n), 0)::int AS n FROM cella.log')).rows[0].n
const has = async (id) => ({
  log: (await db.query("SELECT count(*)::int AS c FROM cella.log WHERE payload->>'invoice' = $1", [id])).rows[0].c,
  state: (await db.query('SELECT count(*)::int AS c FROM invoice.invoice WHERE id = $1', [id])).rows[0].c,
})

async function issue(id, total, finish) {
  await db.query('BEGIN')
  const { rows } = await db.query("SELECT cella.submit('invoice.issue', $1) AS verdict", [{ invoice: id, total }])
  await db.query("INSERT INTO invoice.invoice VALUES ($1, $2, 'issued')", [id, total])
  await db.query(finish)
  return Number(rows[0].verdict)
}

console.log('head before', await head())
const a = await issue('F-2026-031', '1240.00', 'COMMIT')
console.log('COMMIT   verdict', a, 'present', await has('F-2026-031'))
const b = await issue('F-2026-032', '980.00', 'ROLLBACK')
console.log('ROLLBACK verdict', b, 'present', await has('F-2026-032'))
const c = await issue('F-2026-033', '310.00', 'COMMIT')
console.log('COMMIT   verdict', c, 'present', await has('F-2026-033'), '(no gap: follows', a, ')')

// a failing state write aborts the verdict too
try {
  await issue('F-2026-034', '0.00', 'COMMIT')
} catch (e) {
  await db.query('ROLLBACK')
  console.log('state write failed:', e.message, '→ present', await has('F-2026-034'))
}
console.log('verify_log', (await db.query('SELECT cella.verify_log() AS v')).rows[0].v)
await db.end()

// contention: N clients submit at once; the head row lock serialises them, no gaps
const N = 8, each = 250
const start = await (async () => { const c = new pg.Client(cfg); await c.connect(); const r = (await c.query('SELECT coalesce(max(n),0)::int n FROM cella.log')).rows[0].n; await c.end(); return r })()
const t0 = performance.now()
await Promise.all(Array.from({ length: N }, async (_, w) => {
  const c = new pg.Client(cfg)
  await c.connect()
  for (let i = 0; i < each; i++) {
    await c.query('BEGIN')
    await c.query("SELECT cella.submit('load.test', $1)", [{ w, i }])
    await c.query(i % 10 === 9 ? 'ROLLBACK' : 'COMMIT')
  }
  await c.end()
}))
const ms = performance.now() - t0
const v = new pg.Client(cfg)
await v.connect()
const { rows: [s] } = await v.query('SELECT count(*)::int AS rows, max(n)::int AS max, min(n)::int AS min FROM cella.log WHERE n > $1', [start])
console.log(`contention: ${N}×${each} submits (10% rolled back) in ${ms.toFixed(0)} ms → ${(N * each / ms * 1000).toFixed(0)}/s;`,
  `committed ${s.rows}, n ${s.min}..${s.max}, gaps ${s.max - s.min + 1 - s.rows}`)
console.log('verify_log', (await v.query('SELECT cella.verify_log() AS v')).rows[0].v)
await v.end()
