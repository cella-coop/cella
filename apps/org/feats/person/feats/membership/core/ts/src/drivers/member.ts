import type { Db } from '@cella/org-db'
import type { First, Member } from '../models/member.ts'

const columns = `m.address AS id, m.address, p.name, m.status, to_char(m.since, 'YYYY-MM-DD') AS since, m.shares,
  to_char(m.invited, 'YYYY-MM-DD') AS invited, to_char(m.suspended, 'YYYY-MM-DD') AS suspended, to_char(m.exited, 'YYYY-MM-DD') AS exited`
const from = 'membership.member m JOIN person.person p ON p.address = m.address'

// Every member, by name.
export async function members(db: Db): Promise<Member[]> {
  const { rows } = await db.query<Member>(`SELECT ${columns} FROM ${from} ORDER BY p.name`)
  return rows
}

export async function member(db: Db, address: string): Promise<Member | null> {
  const { rows } = await db.query<Member>(`SELECT ${columns} FROM ${from} WHERE m.address = $1`, [address])
  return rows[0] ?? null
}

// The first device a member's invitation carried, and when their
// admission enrolled it, if it has.
export async function first(db: Db, member: string): Promise<First | null> {
  const { rows } = await db.query<First>(
    `SELECT encode(i.key, 'hex') AS key, i.label, to_char(d.enrolled, 'YYYY-MM-DD') AS enrolled
     FROM membership.invitation i LEFT JOIN person.device d ON d.key = i.key
     WHERE i.member = $1`,
    [member],
  )
  return rows[0] ?? null
}
