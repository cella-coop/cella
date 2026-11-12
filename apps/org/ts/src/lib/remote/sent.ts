import type { Schema } from '@cella/org-db'

// A `send`'s argument: the write's address, its name and its fields as
// pairs of texts, as a page without a form posts it, a dropped card's
// move, an agenda's, a document's edit or a settings page's save.
export interface Sent {
  at: Record<string, string>
  write: string
  fields: [string, string][]
}

const MOST = 1 << 22

export const sent: Schema<Sent> = {
  '~standard': {
    version: 1,
    vendor: 'cella',
    validate(value) {
      const v = value as Partial<Sent> | null
      const text = (x: unknown) => typeof x === 'string' && x.length <= MOST
      if (!v || typeof v !== 'object' || typeof v.write !== 'string' || !v.at || typeof v.at !== 'object' || !Object.values(v.at).every(text)) {
        return { issues: [{ message: 'a write names its address and its name' }] }
      }
      if (!Array.isArray(v.fields) || !v.fields.every((p) => Array.isArray(p) && p.length === 2 && text(p[0]) && text(p[1]))) {
        return { issues: [{ message: 'a write’s fields are pairs of texts', path: ['fields'] }] }
      }
      return { value: { at: v.at, write: v.write, fields: v.fields } as Sent }
    },
  },
}
