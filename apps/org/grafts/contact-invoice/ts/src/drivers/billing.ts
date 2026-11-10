import { numbered, type Db } from '@cella/org-db'
import type { Bill, Billed } from '../models/billing.ts'

export async function billed(db: Db, invoice: string): Promise<Billed> {
  const linked = await db.query<{ id: string; name: string }>(
    'SELECT c.id, c.name FROM contact_invoice.billing b JOIN contact.contact c ON c.id = b.contact WHERE b.invoice = $1',
    [invoice],
  )
  const all = await db.query<{ id: string; name: string }>(`SELECT id, name FROM contact.contact WHERE client IS NOT NULL AND NOT archived ORDER BY name`)
  return { contact: linked.rows[0] ?? null, contacts: all.rows }
}

// The contact each invoice bills, by invoice.
export const contactOf = 'SELECT b.invoice AS id, c.name AS contact FROM contact_invoice.billing b JOIN contact.contact c ON c.id = b.contact'

// What each contact owes and is owed back, by contact.
export const standing = 'SELECT contact AS id, owed::bigint AS owed, credit::bigint AS credit FROM contact_invoice.standing'

// The invoices a contact is billed by, latest first.
export async function bills(db: Db, contact: string): Promise<Bill[]> {
  const { rows } = await db.query<Bill>(
    `SELECT i.id, i.label, to_char(i.issued, 'YYYY-MM-DD') AS issued, s.total::bigint AS total, s.owed::bigint AS owed, s.state
     FROM contact_invoice.billing b JOIN invoice.invoice i ON i.id = b.invoice JOIN invoice.standing s ON s.id = i.id
     WHERE b.contact = $1 ORDER BY i.issued DESC, ${numbered('i.id', 'DESC')}`,
    [contact],
  )
  return rows.map((r) => ({ ...r, total: Number(r.total), owed: Number(r.owed) }))
}
