import type { Permission, Refused, Settled } from '@cella/org-ops'
import { plain, type Proof, type Signer } from '@cella/org-sign'

export * from './slice.ts'
export * from './import.ts'

// The one thing a handler needs of a connection; a `pg` Client or pool
// client fits it. A handler holds the connection for its transaction.
export interface Db {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>
}

export interface Deps {
  db: Db
  // The member the write is for.
  actor: string
  // Signs the write's request as the actor's device; the notary checks it.
  sign: Signer
}

export interface Write<T> {
  op: Permission
  // What the member asks for, which their device signs.
  request: unknown
  // The state change, inside the transaction, before the verdict; `proof`
  // names the device that signed.
  state: (tx: Db, proof: Proof) => Promise<T>
  // What the log commits to; it holds a digest of this, never the payload.
  payload: (value: T) => Record<string, unknown>
}

// A personal value in a payload: the notary commits to it, under a fresh
// salt, and keeps the value in the vault, never in the log. `field` is a
// column registered in `cella.personal`, as `schema.table.column`;
// `subject` whose it is, by their address or id.
export const personal = (field: string, subject: string, value: unknown) => ({ $personal: { field, subject, value } })

// An erasure in a payload: the notary erases the subject's personal data
// of the classes named, or of every class, as it settles.
export const erasure = (subject: string, classes?: string[]) => ({ $erase: classes ? { subject, classes } : { subject } })

// SQLSTATE triggered_action_exception: a rule, a feat's trigger or the
// notary's signature check refused.
const REFUSED = '09000'

const code = (e: unknown) => (e as { code?: string }).code

// One write, one transaction: signed first, as the member's device does
// before sending, then the state change, then `cella.submit` last, then
// commit. A refusal raises inside submit, so the state and the verdict roll
// back together and the refusal uses no verdict number.
export async function write<T>(deps: Deps, w: Write<T>): Promise<Settled<T> | Refused> {
  const { db } = deps
  const request = plain(w.request)
  const proof = await deps.sign(w.op, request)
  await db.query('BEGIN')
  try {
    // The transaction reads as the actor, and as a write's: its state
    // change sees the whole state, as the rules do.
    await db.query(`SELECT set_config('cella.actor', $1, true), set_config('cella.writing', 'on', true)`, [deps.actor])
    const value = await w.state(db, proof)
    // Deferred checks, such as an entry balancing, refuse before the
    // verdict rather than at commit, after it.
    await db.query('SET CONSTRAINTS ALL IMMEDIATE')
    const { rows } = await db.query<{ verdict: string }>(
      'SELECT verdict FROM cella.submit($1, $2, $3, $4)',
      [w.op, w.payload(value), deps.actor, { request, ...proof }],
    )
    await db.query('COMMIT')
    return { state: 'settled', entry: Number(rows[0].verdict), value }
  } catch (e) {
    await db.query('ROLLBACK')
    if (code(e) !== REFUSED) {
      throw e
    }
    // A refusal is numbered by the last verdict it was judged after.
    const { rows } = await db.query<{ n: string }>('SELECT n FROM cella.head')
    return { state: 'refused', verdict: Number(rows[0].n), reason: (e as Error).message }
  }
}
