import type { Db } from '@cella/org-db'
import { b64, type Canon } from '@cella/org-body/models'
import type { BodiedPeriod } from '../models/body-period.ts'

// A record's body as its page reads it: its snapshot and its canonical form.
export async function bodiedPeriod(db: Db, id: string): Promise<BodiedPeriod> {
  const { rows } = await db.query<{ body: Uint8Array | null; canon: string | null }>(
    'SELECT body, cella.document_canonical(body) AS canon FROM account.period WHERE month = $1',
    [id],
  )
  const body = rows[0]?.body
  const canon = rows[0]?.canon
  return { snapshot: body ? b64.encode(new Uint8Array(body)) : null, canon: canon ? (JSON.parse(canon) as Canon) : null }
}

// What core body's session reads of a record: its circle, and its saved
// body, as the reader sees them.
export async function bodyCirclePeriod(db: Db, id: string): Promise<string | null> {
  const { rows } = await db.query<{ circle: string }>('SELECT circle FROM account.period WHERE month = $1', [id])
  return rows[0]?.circle ?? null
}

export async function savedBodyPeriod(db: Db, id: string): Promise<Uint8Array | null> {
  const { rows } = await db.query<{ body: Uint8Array | null }>('SELECT body FROM account.period WHERE month = $1', [id])
  return rows[0]?.body ? new Uint8Array(rows[0].body) : null
}
