import type { Permission, Refused, Settled } from '@cella/org-ops'

// The one thing a handler needs of a connection; a `pg` Client or pool
// client fits it. A handler holds the connection for its transaction.
export interface Db {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>
}

export interface Deps {
  db: Db
  // The member the write is for, already authenticated.
  actor: string
}

export interface Write<T> {
  op: Permission
  // The state change, inside the transaction, before the verdict.
  state: (tx: Db) => Promise<T>
  // What the log commits to; it holds a digest of this, never the payload.
  payload: (value: T) => Record<string, unknown>
}

// SQLSTATE triggered_action_exception: a rule or a feat's trigger refused.
const REFUSED = '09000'

const code = (e: unknown) => (e as { code?: string }).code

// One write, one transaction: the state change, then `cella.submit` last,
// then commit. A refusal raises inside submit, so the state and the verdict
// roll back together and the refusal uses no verdict number.
export async function write<T>(deps: Deps, w: Write<T>): Promise<Settled<T> | Refused> {
  const { db } = deps
  await db.query('BEGIN')
  try {
    const value = await w.state(db)
    // Deferred checks, such as an entry balancing, refuse before the
    // verdict rather than at commit, after it.
    await db.query('SET CONSTRAINTS ALL IMMEDIATE')
    const { rows } = await db.query<{ verdict: string }>(
      'SELECT verdict FROM cella.submit($1, $2, $3)',
      [w.op, w.payload(value), deps.actor],
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
