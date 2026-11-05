import type { Permission, Refused, Settled } from '@cella/org-actions'
import { plain, type Proof, type Signer } from '@cella/org-sign'

export * from './slice.ts'
export * from './import.ts'
export * from './read.ts'

// The one thing a handler needs of a connection; a `pg` Client or pool
// client fits it.
export interface Db {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>
}

// Lends one connection, inside a transaction of its own, for as long as
// `fn` runs: committed when it returns, rolled back when it throws.
export type Borrow = <T>(fn: (db: Db) => Promise<T>) => Promise<T>

// A pool a server borrows from, as a `pg` Pool is one.
export interface Pool {
  connect(): Promise<Db & { release(e?: Error): void }>
}

// A server's borrows from `pool`, each as `role` reading for `actor`, the
// signed-in person, or for no one: the transaction sets both for itself
// alone before `fn`'s first query, so every row-level policy reads as
// them, and both clear themselves as it commits or rolls back. A
// connection goes back reading as no one with no reset, even after a
// borrow that threw; one whose rollback fails is closed.
export function lending(pool: Pool, role: string) {
  return async <T>(actor: string | null, fn: (db: Db) => Promise<T>): Promise<T> => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SELECT set_config('role', $1, true), set_config('cella.actor', $2, true)`, [role, actor ?? ''])
      const value = await fn(client)
      await client.query('COMMIT')
      client.release()
      return value
    } catch (e) {
      await client.query('ROLLBACK').then(
        () => client.release(),
        (r: Error) => client.release(r),
      )
      throw e
    }
  }
}

// A transaction on one connection held throughout, as a test holds one,
// lent as a server's borrow lends one.
export const holding =
  (db: Db): Borrow =>
  async (fn) => {
    await db.query('BEGIN')
    try {
      const value = await fn(db)
      await db.query('COMMIT')
      return value
    } catch (e) {
      await db.query('ROLLBACK')
      throw e
    }
  }

export interface Deps {
  // What a handler reads on before its write. Nothing read here binds the
  // write: its guards read again inside its transaction.
  db: Db
  // Lends the connection a write's transaction runs on, once it is
  // signed; left out, as by a test holding one connection throughout, the
  // transaction runs on `db`.
  borrow?: Borrow
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

// SQLSTATE triggered_action_exception: a guard, a feat's trigger or the
// notary's signature check refused.
const REFUSED = '09000'

const code = (e: unknown) => (e as { code?: string }).code

// What a server lends a write from `using`: reads that borrow a
// connection for each statement alone, and a connection for each
// transaction, so a write waiting on its signer holds none.
export function lent(using: Borrow): Pick<Deps, 'db' | 'borrow'> {
  return {
    db: { query: <R>(text: string, values?: unknown[]) => using((db) => db.query<R>(text, values)) },
    borrow: using,
  }
}

// One write, one transaction: signed first, as the member's device does
// before sending, with no connection held, then the transaction of a
// connection borrowed for it alone, begun with `cella.begin`, then the
// state change, then `cella.submit` last, then the borrow commits. A state
// table takes rows only in a begun transaction, and one commits only with
// its verdict. A refusal raises inside submit, so the borrow rolls the
// state and the verdict back together and the refusal uses no verdict
// number.
export async function write<T>(deps: Deps, w: Write<T>): Promise<Settled<T> | Refused> {
  const request = plain(w.request)
  const proof = await deps.sign(w.op, request)
  const borrow = deps.borrow ?? holding(deps.db)
  try {
    return await borrow((db) => transact(db, deps.actor, w, request, proof))
  } catch (e) {
    if (code(e) !== REFUSED) {
      throw e
    }
    // A refusal is numbered by the last verdict it was judged after.
    const { rows } = await borrow((db) => db.query<{ n: string }>('SELECT n FROM cella.head'))
    return { state: 'refused', verdict: Number(rows[0].n), reason: (e as Error).message }
  }
}

async function transact<T>(db: Db, actor: string, w: Write<T>, request: unknown, proof: Proof): Promise<Settled<T>> {
  // The transaction reads as the actor, and as a write's: its state
  // change sees the whole state, as the guards do.
  await db.query(`SELECT set_config('cella.actor', $1, true), set_config('cella.writing', 'on', true)`, [actor])
  await db.query(`SELECT cella.begin($1, $2, decode($3, 'hex'))`, [w.op, actor, proof.device])
  const value = await w.state(db, proof)
  // Deferred checks, such as an entry balancing, refuse before the
  // verdict rather than at commit, after it.
  await db.query('SET CONSTRAINTS ALL IMMEDIATE')
  const { rows } = await db.query<{ verdict: string }>(
    'SELECT verdict FROM cella.submit($1, $2, $3, $4)',
    [w.op, w.payload(value), actor, { request, ...proof }],
  )
  return { state: 'settled', entry: Number(rows[0].verdict), value }
}
