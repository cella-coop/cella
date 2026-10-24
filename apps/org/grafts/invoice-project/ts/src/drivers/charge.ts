import type { Db } from '@cella/org-db'
import type { Charged, Invoiced } from '../models/charge.ts'

// The project each invoice bills, by invoice.
export async function projectOf(db: Db): Promise<Record<string, { project: string }>> {
  const { rows } = await db.query<{ invoice: string; title: string }>(
    'SELECT c.invoice, p.title FROM invoice_project.charge c JOIN project.project p ON p.id = c.project',
  )
  return Object.fromEntries(rows.map((r) => [r.invoice, { project: r.title }]))
}

export async function charged(db: Db, invoice: string): Promise<Charged> {
  const linked = await db.query<{ id: string; title: string }>(
    'SELECT p.id, p.title FROM invoice_project.charge c JOIN project.project p ON p.id = c.project WHERE c.invoice = $1',
    [invoice],
  )
  const all = await db.query<{ id: string; title: string }>('SELECT id, title FROM project.project WHERE archived IS NULL ORDER BY title')
  return { project: linked.rows[0] ?? null, projects: all.rows }
}

// What each project invoiced, net of VAT and voids, by project.
export async function invoicedBy(db: Db): Promise<Record<string, { invoiced: number }>> {
  const { rows } = await db.query<{ project: string; net: string }>('SELECT project, net FROM invoice_project.invoiced')
  return Object.fromEntries(rows.map((r) => [r.project, { invoiced: Number(r.net) }]))
}

// A project's invoices, the latest first.
export async function invoiced(db: Db, project: string): Promise<Invoiced> {
  const { rows } = await db.query<{ id: string; label: string; issued: string; net: string; voided: string | null }>(
    `SELECT i.id, i.label, to_char(i.issued, 'YYYY-MM-DD') AS issued, cella.cents(i.net) AS net, to_char(i.voided, 'YYYY-MM-DD') AS voided
     FROM invoice_project.charge c JOIN invoice.invoice i ON i.id = c.invoice
     WHERE c.project = $1 ORDER BY i.issued DESC, i.id DESC`,
    [project],
  )
  const invoices = rows.map((r) => ({ ...r, net: Number(r.net) }))
  return { invoices, net: invoices.filter((i) => !i.voided).reduce((s, i) => s + i.net, 0) }
}
