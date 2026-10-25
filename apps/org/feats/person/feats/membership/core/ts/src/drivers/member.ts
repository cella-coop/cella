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

// The first device a member's invitation enrolled, once taken up.
export async function first(db: Db, member: string): Promise<First | null> {
  const { rows } = await db.query<First>(
    `SELECT encode(key, 'hex') AS key, label, to_char(accepted, 'YYYY-MM-DD') AS accepted
     FROM membership.invitation WHERE member = $1 AND accepted IS NOT NULL`,
    [member],
  )
  return rows[0] ?? null
}

// How many links an invited member's invitation may still be taken up by:
// none once one is.
export async function links(db: Db, member: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM membership.link l
     WHERE l.member = $1 AND NOT EXISTS (SELECT FROM membership.invitation i WHERE i.member = l.member)`,
    [member],
  )
  return rows[0].n
}

// Whom an invitation link invites, by its secret in hex, while they are
// invited and have not taken it up; null for a link that is no one's.
export async function invitation(db: Db, secret: string): Promise<{ member: string; name: string } | null> {
  if (!/^[0-9a-f]{64}$/.test(secret)) {
    return null
  }
  const { rows } = await db.query<{ member: string; name: string }>(
    `SELECT m.address AS member, p.name
     FROM membership.link l
     JOIN membership.member m ON m.address = l.member AND m.status = 'invited'
     JOIN person.person p ON p.address = m.address
     WHERE l.digest = sha256(decode($1, 'hex'))
       AND NOT EXISTS (SELECT FROM membership.invitation i WHERE i.member = m.address)`,
    [secret],
  )
  return rows[0] ?? null
}
