import type { Db } from '@cella/org-db'
import type { Bill, Billed, Owing } from '../models/billing.ts'

export async function billed(db: Db, invoice: string): Promise<Billed> {
  const linked = await db.query<{ id: string; name: string }>(
    'SELECT c.id, c.name FROM client_invoice.billing b JOIN client.client c ON c.id = b.client WHERE b.invoice = $1',
    [invoice],
  )
  const all = await db.query<{ id: string; name: string }>(`SELECT id, name FROM client.client WHERE status <> 'archived' ORDER BY name`)
  return { client: linked.rows[0] ?? null, clients: all.rows }
}

// The client each invoice bills, by invoice.
export async function clientOf(db: Db): Promise<Record<string, { client: string }>> {
  const { rows } = await db.query<{ invoice: string; name: string }>(
    'SELECT b.invoice, c.name FROM client_invoice.billing b JOIN client.client c ON c.id = b.client',
  )
  return Object.fromEntries(rows.map((r) => [r.invoice, { client: r.name }]))
}

// What each client owes and is owed back, by client.
export async function standing(db: Db): Promise<Record<string, Owing>> {
  const { rows } = await db.query<{ client: string; owed: string; credit: string }>('SELECT client, owed, credit FROM client_invoice.standing')
  return Object.fromEntries(rows.map((r) => [r.client, { owed: Number(r.owed), credit: Number(r.credit) }]))
}

// The invoices a client is billed by, latest first.
export async function bills(db: Db, client: string): Promise<Bill[]> {
  const { rows } = await db.query<Bill>(
    `SELECT i.id, i.label, to_char(i.issued, 'YYYY-MM-DD') AS issued, s.total::bigint AS total, s.owed::bigint AS owed, s.state
     FROM client_invoice.billing b JOIN invoice.invoice i ON i.id = b.invoice JOIN invoice.standing s ON s.id = i.id
     WHERE b.client = $1 ORDER BY i.issued DESC, i.id DESC`,
    [client],
  )
  return rows.map((r) => ({ ...r, total: Number(r.total), owed: Number(r.owed) }))
}
