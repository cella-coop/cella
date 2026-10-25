import type { Db } from '@cella/org-db'
import type { Granted, Held, Pot } from '../models/share.ts'

// What each project has shared out, by project.
export async function shared(db: Db): Promise<Record<string, { shared: number }>> {
  const { rows } = await db.query<{ project: string; shared: string }>('SELECT project, shared FROM membership_project.pot')
  return Object.fromEntries(rows.map((r) => [r.project, { shared: Number(r.shared) }]))
}

export async function pot(db: Db, project: string): Promise<Pot> {
  const { rows } = await db.query<{ budget: string | null; shared: string; remaining: string | null; archived: boolean }>(
    `SELECT t.budget, t.shared, t.remaining, p.archived IS NOT NULL AS archived
     FROM membership_project.pot t JOIN project.project p ON p.id = t.project WHERE t.project = $1`,
    [project],
  )
  const { rows: shares } = await db.query<Omit<Granted, 'amount'> & { amount: string }>(
    `SELECT s.id::text AS id, s.member, mp.name, cella.cents(s.amount) AS amount, to_char(s.granted, 'YYYY-MM-DD') AS granted
     FROM membership_project.share s JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = s.member
     WHERE s.project = $1 ORDER BY s.granted, s.id`,
    [project],
  )
  const { rows: members } = await db.query<{ address: string; name: string }>(
    `SELECT m.address, p.name FROM membership.member m JOIN person.person p ON p.address = m.address WHERE m.status = 'active' ORDER BY p.name`,
  )
  const r = rows[0]
  const n = (x: string | null | undefined) => (x === null || x === undefined ? null : Number(x))
  return {
    budget: n(r?.budget),
    shared: Number(r?.shared ?? 0),
    remaining: n(r?.remaining),
    shares: shares.map((s) => ({ ...s, amount: Number(s.amount) })),
    members,
    archived: r?.archived ?? false,
  }
}

// A member's shares, the latest first.
export async function held(db: Db, member: string): Promise<Held[]> {
  const { rows } = await db.query<Omit<Held, 'amount'> & { amount: string }>(
    `SELECT s.id::text AS id, s.project, p.title, cella.cents(s.amount) AS amount, to_char(s.granted, 'YYYY-MM-DD') AS granted
     FROM membership_project.share s JOIN project.project p ON p.id = s.project
     WHERE s.member = $1 ORDER BY s.granted DESC, s.id DESC`,
    [member],
  )
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }))
}
