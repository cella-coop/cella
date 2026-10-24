import type { Db } from '@cella/org-db'
import type { Member } from '../models/member.ts'

const columns = `address AS id, address, name, email, phone, status, to_char(since, 'YYYY-MM-DD') AS since, shares,
  to_char(invited, 'YYYY-MM-DD') AS invited, to_char(suspended, 'YYYY-MM-DD') AS suspended, to_char(exited, 'YYYY-MM-DD') AS exited`

// Every member, by name.
export async function members(db: Db): Promise<Member[]> {
  const { rows } = await db.query<Member>(`SELECT ${columns} FROM member.member ORDER BY name`)
  return rows
}

export async function member(db: Db, address: string): Promise<Member | null> {
  const { rows } = await db.query<Member>(`SELECT ${columns} FROM member.member WHERE address = $1`, [address])
  return rows[0] ?? null
}
