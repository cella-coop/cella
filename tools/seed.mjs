// seed: loads a mock co-op's members, decisions with their stances and the
// decision-member admissions into the feat schemas, as the state carried
// over from before the log. Stances take receipts in file order; a closed
// decision's cutoff is the receipt after its last stance.
// Usage: node tools/seed.mjs apps/org/fixtures/<co-op>

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import pg from 'pg'

const dir = process.argv[2]
const read = (file) => {
  const path = join(dir, `${file}.toml`)
  return existsSync(path) ? parse(readFileSync(path, 'utf8')) : {}
}
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

const db = new pg.Client()
await db.connect()
await db.query('BEGIN')

const members = read('member').member ?? []
for (const m of members) {
  await db.query(
    'INSERT INTO member.member (address, name, status, since, shares) VALUES ($1, $2, $3, $4, $5)',
    [m.address, m.name, m.status, day(m.since), m.shares],
  )
}

const decisions = read('decision').decision ?? []
let votes = 0
for (const d of decisions) {
  await db.query(
    `INSERT INTO decision.decision (id, circle, title, rule, proposed, deadline, body)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [d.id, d.circle, d.title, d.rule, day(d.proposed), day(d.deadline), d.body ?? ''],
  )
  for (const v of d.vote ?? []) {
    await db.query(
      'INSERT INTO decision.vote (receipt, decision, member, stance, at) VALUES (cella.receipt(), $1, $2, $3, $4)',
      [d.id, v.member, v.stance, day(v.at)],
    )
    votes++
  }
  if (d.closed) {
    await db.query('UPDATE decision.decision SET closed = $2, cutoff = cella.receipt() WHERE id = $1', [d.id, day(d.closed)])
  }
}

const admissions = read('graft.decision-member').admission ?? []
for (const a of admissions) {
  await db.query('INSERT INTO decision_member.admission (decision, member, shares) VALUES ($1, $2, $3)', [a.decision, a.member, a.shares])
}

await db.query('COMMIT')
await db.end()
console.log(`seed: ${members.length} members, ${decisions.length} decisions, ${votes} stances, ${admissions.length} admissions into ${db.database}`)
