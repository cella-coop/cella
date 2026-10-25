import { csv, type Imported, type Importer } from '@cella/org-db'
import { carry } from '../handlers/carry.ts'
import type { Line } from '@cella/org-transaction/models'

// The FEC, the fichier des écritures comptables every French accounting
// tool exports (Livre des procédures fiscales, art. L47 A and A47 A-1):
// one line of an entry per row, eighteen fields separated by a tab or a
// bar, a header naming them, dates as AAAAMMJJ and amounts with a decimal
// comma, in Debit and Credit or in Montant and Sens. This reads the fields
// it needs by their names, so a file with the optional ones reads too.
const needed = ['JournalCode', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'EcritureLib']

const date = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '')

// An amount in cents, from `1234,56`, `1234.56` or `1 234,56`.
const cents = (typed: string) => Math.round(Number((typed || '0').replace(/\s/g, '').replace(',', '.')) * 100)

// A row's side and amount: Debit or Credit, or Montant with Sens D or C.
function sided(f: Record<string, string>): { side: Line['side']; cents: number } | null {
  if ('Montant' in f && 'Sens' in f) {
    const c = cents(f.Montant)
    return c > 0 || Number.isNaN(c) ? { side: /^d/i.test(f.Sens) ? 'debit' : 'credit', cents: c } : null
  }
  const debit = cents(f.Debit)
  const credit = cents(f.Credit)
  if (Number.isNaN(debit) || Number.isNaN(credit)) {
    return { side: 'debit', cents: Number.NaN }
  }
  return debit > 0 ? { side: 'debit', cents: debit } : credit > 0 ? { side: 'credit', cents: credit } : null
}

// A company's books from its last tool: each entry, by its journal and
// number, carried over on its date as the importing member, under their
// power to carry the books over, opening in the same write the accounts
// it names that the chart lacks. An entry in no period of the books, or a
// closed one, is refused as one posted by hand is, and so is one that
// does not balance: the opening balances of a co-op switching to cella
// are the entries of its à-nouveaux journal, dated in its first open
// month. A line is labelled by its entry's journal and number.
export const fec: Importer = {
  title: 'Books (FEC)',
  formats: 'the FEC every French accounting tool exports, tab- or bar-separated: the entries, and the accounts they name',
  read: async (text) => {
    const rows = csv(text)
    const missing = needed.filter((n) => rows.length && !(n in rows[0].fields))
    if (!rows.length || missing.length) {
      throw new Error(`this is no FEC: its header lacks ${missing.join(', ') || 'every field'}`)
    }
    const entries = new Map<string, { line: number; date: string; label: string; lines: Line[]; accounts: Map<string, string>; unread: boolean }>()
    for (const { line, fields } of rows) {
      const key = `${fields.JournalCode} ${fields.EcritureNum}`
      const label = [key, fields.EcritureLib || fields.JournalLib].filter(Boolean).join(', ')
      const e = entries.get(key) ?? { line, date: date(fields.EcritureDate), label, lines: [] as Line[], accounts: new Map<string, string>(), unread: false }
      const side = sided(fields)
      if (side) {
        e.lines.push({ account: fields.CompteNum, side: side.side, cents: side.cents })
        e.accounts.set(fields.CompteNum, fields.CompteLib || fields.CompteNum)
      }
      e.unread ||= !e.date || Number.isNaN(side?.cents ?? 0)
      entries.set(key, e)
    }
    return [...entries].map(([key, e]): Imported => {
      const op = 'account-transaction:entry:carry'
      if (e.unread || !e.lines.length) {
        return { line: e.line, label: key, op, refused: 'its date or its amounts cannot be read' }
      }
      const accounts = [...e.accounts].map(([code, label]) => ({ code, label }))
      return { line: e.line, label: key, op, run: (deps) => carry({ date: e.date, label: e.label, lines: e.lines }, accounts, deps) }
    })
  },
}
