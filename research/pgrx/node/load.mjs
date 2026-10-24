// Load Lanterne's members, decisions and votes from the fixtures into the feat schemas.
import { readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import pg from 'pg'

const dir = new URL('../../../apps/org/fixtures/lanterne/', import.meta.url)
const read = (f) => parse(readFileSync(new URL(f, dir), 'utf8'))
const day = (d) => d.toISOString().slice(0, 10)

const db = new pg.Client({ host: '127.0.0.1', port: 54318, user: 'postgres', database: 'spike' })
await db.connect()
await db.query('BEGIN')
for (const m of read('member.toml').member) {
  await db.query('INSERT INTO member.member VALUES ($1, $2)', [m.address, m.status])
}
let votes = 0
for (const d of read('decision.toml').decision) {
  await db.query('INSERT INTO decision.decision VALUES ($1, $2, $3)', [d.id, d.circle, d.rule])
  for (const v of d.vote ?? []) {
    await db.query('INSERT INTO decision.vote VALUES ($1, $2, $3, $4)', [d.id, v.member, v.stance, day(v.at)])
    votes++
  }
}
await db.query('COMMIT')
console.log(`loaded ${(await db.query('select count(*) from member.member')).rows[0].count} members, ${votes} votes`)
await db.end()
